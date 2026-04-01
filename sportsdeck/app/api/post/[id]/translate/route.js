import { NextResponse } from 'next/server';
import { prisma } from '@/prisma/db';
import { InferenceClient } from '@huggingface/inference';

const client = new InferenceClient(process.env.HF_TOKEN);
const EXTERNAL_MOCK_ENABLED =
    process.env.MOCK_EXTERNAL_APIS === 'true' || process.env.NODE_ENV === 'test';
const LANGUAGE_DETECTION_MODEL = 'papluca/xlm-roberta-base-language-detection';
const PRIMARY_TRANSLATION_MODEL = 'facebook/mbart-large-50-many-to-many-mmt';
const FALLBACK_TRANSLATION_MODEL = 'Helsinki-NLP/opus-mt-mul-en';
const MBART_LANGUAGE_CODES = {
    ar: 'ar_AR',
    cs: 'cs_CZ',
    de: 'de_DE',
    en: 'en_XX',
    es: 'es_XX',
    et: 'et_EE',
    fi: 'fi_FI',
    fr: 'fr_XX',
    gu: 'gu_IN',
    hi: 'hi_IN',
    it: 'it_IT',
    ja: 'ja_XX',
    kk: 'kk_KZ',
    ko: 'ko_KR',
    lt: 'lt_LT',
    lv: 'lv_LV',
    my: 'my_MM',
    ne: 'ne_NP',
    nl: 'nl_XX',
    ro: 'ro_RO',
    ru: 'ru_RU',
    si: 'si_LK',
    tr: 'tr_TR',
    vi: 'vi_VN',
    zh: 'zh_CN',
    af: 'af_ZA',
    az: 'az_AZ',
    bn: 'bn_IN',
    fa: 'fa_IR',
    he: 'he_IL',
    hr: 'hr_HR',
    id: 'id_ID',
    ka: 'ka_GE',
    km: 'km_KH',
    mk: 'mk_MK',
    ml: 'ml_IN',
    mn: 'mn_MN',
    mr: 'mr_IN',
    pl: 'pl_PL',
    ps: 'ps_AF',
    pt: 'pt_XX',
    sv: 'sv_SE',
    sw: 'sw_KE',
    ta: 'ta_IN',
    te: 'te_IN',
    th: 'th_TH',
    tl: 'tl_XX',
    uk: 'uk_UA',
    ur: 'ur_PK',
    xh: 'xh_ZA',
    gl: 'gl_ES',
    sl: 'sl_SI',
};

function normalizeTranslatedText(result) {
    if (typeof result?.translation_text === 'string') {
        return result.translation_text.trim();
    }
    if (Array.isArray(result)) {
        const first = result.find((entry) => typeof entry?.translation_text === 'string');
        return first?.translation_text?.trim() ?? '';
    }
    return '';
}

function looksLikeBadTranslation(originalText, translatedText) {
    if (!translatedText) {
        return true;
    }

    const normalizedOriginal = originalText.trim().toLowerCase();
    const normalizedTranslation = translatedText.trim().toLowerCase();

    if (normalizedTranslation === normalizedOriginal) {
        return true;
    }
    return /@info:|whatsthis|day\(s\)/i.test(translatedText);
}

function normalizeDetectedLanguage(result) {
    if (Array.isArray(result)) {
        const sorted = [...result].sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0));
        const label = sorted[0]?.label;
        return typeof label === 'string' ? label.toLowerCase() : null;
    }
    if (typeof result?.label === 'string') {
        return result.label.toLowerCase();
    }
    return null;
}

async function detectSourceLanguage(text) {
    try {
        const result = await client.textClassification({
            model: LANGUAGE_DETECTION_MODEL,
            inputs: text,
            provider: 'hf-inference',
        });
        return normalizeDetectedLanguage(result);
    } catch (error) {
        console.error('Error detecting translation source language:', error);
        return null;
    }
}

// This GET request handler for the /api/post/[id]/translate endpoint takes a post ID as a parameter, fetches the post content from the database, and then uses the Hugging Face Inference API to translate the content into English. \
// It includes error handling for various scenarios, such as missing post, invalid post ID, or issues with the translation API. 
// It also supports a mock mode for testing purposes where it simply returns a mocked translation without calling the external API.
export async function POST(request, { params }) {
    try {
        const forceMock = request.headers.get('x-mock-external-apis') === 'true';
        const { id } = await params;
        const postId = Number(id);
        const post = await prisma.post.findUnique({
            where: { id: postId },
            select: { id: true, content: true },
        });
        if (!post) {
            return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }
        let translate;
        if (EXTERNAL_MOCK_ENABLED || forceMock) {
            translate = { translation_text: `[MOCK] ${post.content}` };
        } else {
            const detectedLanguage = await detectSourceLanguage(post.content);
            const sourceLanguageCode = detectedLanguage
                ? MBART_LANGUAGE_CODES[detectedLanguage] ?? null
                : null;

            translate = sourceLanguageCode
                ? await client.translation({
                    model: PRIMARY_TRANSLATION_MODEL,
                    inputs: post.content,
                    provider: 'hf-inference',
                    parameters: {
                        src_lang: sourceLanguageCode,
                        tgt_lang: 'en_XX',
                    },
                })
                : await client.translation({
                    model: FALLBACK_TRANSLATION_MODEL,
                    inputs: post.content,
                    provider: 'hf-inference',
                });
        }
        const translatedText = normalizeTranslatedText(translate);
        // if (!EXTERNAL_MOCK_ENABLED && !forceMock && looksLikeBadTranslation(post.content, translatedText)) {
        //     return NextResponse.json(
        //         { error: 'Translation provider returned an unusable translation' },
        //         { status: 502 },
        //     );
        // }
        return NextResponse.json({
            id: id,
            message: 'Translation fetched successfully',
            originalText: post.content,
            translatedText,
        });
    } catch (error) {        
        console.error("Error fetching translation:", error);
        return NextResponse.json({ error: 'Failed to fetch translation' }, { status: 500 });
    }  
}
