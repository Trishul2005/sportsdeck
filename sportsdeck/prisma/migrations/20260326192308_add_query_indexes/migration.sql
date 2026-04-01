-- CreateIndex
CREATE INDEX "Appeal_userId_status_idx" ON "Appeal"("userId", "status");

-- CreateIndex
CREATE INDEX "Appeal_createdAt_idx" ON "Appeal"("createdAt");

-- CreateIndex
CREATE INDEX "Follow_followerId_idx" ON "Follow"("followerId");

-- CreateIndex
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE INDEX "Match_date_idx" ON "Match"("date");

-- CreateIndex
CREATE INDEX "Match_status_date_idx" ON "Match"("status", "date");

-- CreateIndex
CREATE INDEX "Match_homeTeamId_date_idx" ON "Match"("homeTeamId", "date");

-- CreateIndex
CREATE INDEX "Match_awayTeamId_date_idx" ON "Match"("awayTeamId", "date");

-- CreateIndex
CREATE INDEX "Poll_threadId_idx" ON "Poll"("threadId");

-- CreateIndex
CREATE INDEX "Poll_createdById_createdAt_idx" ON "Poll"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "Poll_deadline_idx" ON "Poll"("deadline");

-- CreateIndex
CREATE INDEX "PollOption_pollId_idx" ON "PollOption"("pollId");

-- CreateIndex
CREATE INDEX "PollVote_pollId_idx" ON "PollVote"("pollId");

-- CreateIndex
CREATE INDEX "PollVote_optionId_idx" ON "PollVote"("optionId");

-- CreateIndex
CREATE INDEX "PollVote_userId_idx" ON "PollVote"("userId");

-- CreateIndex
CREATE INDEX "Post_threadId_createdAt_idx" ON "Post"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_authorId_createdAt_idx" ON "Post"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_parentId_idx" ON "Post"("parentId");

-- CreateIndex
CREATE INDEX "Post_isVisible_createdAt_idx" ON "Post"("isVisible", "createdAt");

-- CreateIndex
CREATE INDEX "Report_reportedById_idx" ON "Report"("reportedById");

-- CreateIndex
CREATE INDEX "Report_postId_idx" ON "Report"("postId");

-- CreateIndex
CREATE INDEX "Report_threadId_idx" ON "Report"("threadId");

-- CreateIndex
CREATE INDEX "Report_isResolved_createdAt_idx" ON "Report"("isResolved", "createdAt");

-- CreateIndex
CREATE INDEX "TagThread_threadId_idx" ON "TagThread"("threadId");

-- CreateIndex
CREATE INDEX "Team_conference_idx" ON "Team"("conference");

-- CreateIndex
CREATE INDEX "Team_division_idx" ON "Team"("division");

-- CreateIndex
CREATE INDEX "Thread_createdById_idx" ON "Thread"("createdById");

-- CreateIndex
CREATE INDEX "Thread_teamId_createdAt_idx" ON "Thread"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "Thread_matchId_createdAt_idx" ON "Thread"("matchId", "createdAt");

-- CreateIndex
CREATE INDEX "Thread_isVisible_createdAt_idx" ON "Thread"("isVisible", "createdAt");

-- CreateIndex
CREATE INDEX "Thread_opensAt_idx" ON "Thread"("opensAt");

-- CreateIndex
CREATE INDEX "Thread_closesAt_idx" ON "Thread"("closesAt");

-- CreateIndex
CREATE INDEX "User_favoriteTeamId_idx" ON "User"("favoriteTeamId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isBanned_idx" ON "User"("isBanned");
