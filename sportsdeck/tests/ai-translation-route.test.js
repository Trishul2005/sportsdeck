describe("POST /api/post/[id]/translate route behavior", () => {
  const makeRequest = (mockHeaderValue = null) => ({
    headers: {
      get: (name) => (name === "x-mock-external-apis" ? mockHeaderValue : null),
    },
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("uses mock translation when mock mode is enabled", async () => {
    process.env.NODE_ENV = "test";
    process.env.MOCK_EXTERNAL_APIS = "false";

    const findUnique = jest.fn().mockResolvedValue({
      id: 1,
      content: "Bonjour le monde",
      parentId: null,
    });

    const translation = jest.fn().mockResolvedValue({ translation_text: "unused" });
    const textClassification = jest.fn().mockResolvedValue([{ label: "fr", score: 0.99 }]);
    const InferenceClient = jest.fn(() => ({ translation, textClassification }));

    jest.doMock("@/prisma/db", () => ({
      prisma: { post: { findUnique } },
    }));
    jest.doMock("@huggingface/inference", () => ({ InferenceClient }));

    const { POST } = require("../app/api/post/[id]/translate/route");
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.translatedText).toBe("[MOCK] Bonjour le monde");
    expect(textClassification).not.toHaveBeenCalled();
    expect(translation).not.toHaveBeenCalled();
  });

  it("uses Hugging Face translation when non-mock mode is enabled", async () => {
    process.env.NODE_ENV = "development";
    process.env.MOCK_EXTERNAL_APIS = "false";

    const findUnique = jest.fn().mockResolvedValue({
      id: 2,
      content: "Hola mundo",
      parentId: null,
    });

    const translation = jest.fn().mockResolvedValue({ translation_text: "Hello world" });
    const textClassification = jest.fn().mockResolvedValue([{ label: "es", score: 0.99 }]);
    const InferenceClient = jest.fn(() => ({ translation, textClassification }));

    jest.doMock("@/prisma/db", () => ({
      prisma: { post: { findUnique } },
    }));
    jest.doMock("@huggingface/inference", () => ({ InferenceClient }));

    const { POST } = require("../app/api/post/[id]/translate/route");
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "2" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.originalText).toBe("Hola mundo");
    expect(body.translatedText).toBe("Hello world");
    expect(textClassification).toHaveBeenCalledWith({
      model: "papluca/xlm-roberta-base-language-detection",
      inputs: "Hola mundo",
      provider: "hf-inference",
    });
    expect(translation).toHaveBeenCalledWith({
      model: "facebook/mbart-large-50-many-to-many-mmt",
      inputs: "Hola mundo",
      provider: "hf-inference",
      parameters: {
        src_lang: "es_XX",
        tgt_lang: "en_XX",
      },
    });
  });
});
