-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "total_points_earned" INTEGER NOT NULL DEFAULT 0,
    "insurance_locked" BOOLEAN NOT NULL DEFAULT false,
    "last_insured_parlay_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "sid" VARCHAR(255) NOT NULL,
    "sess" JSONB NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,
    "user_id" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "external_id" VARCHAR(255),
    "sport" VARCHAR(50) NOT NULL,
    "home_team" VARCHAR(255) NOT NULL,
    "away_team" VARCHAR(255) NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "home_score" INTEGER,
    "away_score" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bets" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "bet_type" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "bet_value" VARCHAR(100),
    "display_text" VARCHAR(255) NOT NULL,
    "display_text_override" VARCHAR(255),
    "config" JSONB,
    "outcome" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 2,
    "resolved_at" TIMESTAMP(3),
    "last_fetched_at" TIMESTAMP(3),
    "needs_admin_resolution" BOOLEAN NOT NULL DEFAULT false,
    "admin_resolution_notes" TEXT,
    "visible_from" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parlays" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bet_count" INTEGER NOT NULL,
    "parlay_value" INTEGER NOT NULL,
    "insured" BOOLEAN NOT NULL DEFAULT false,
    "insurance_cost" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'building',
    "locked_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "last_game_end_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parlays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streak_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "parlay_id" TEXT,
    "old_streak" INTEGER NOT NULL,
    "new_streak" INTEGER NOT NULL,
    "change_amount" INTEGER NOT NULL,
    "change_type" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "streak_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_bet_selections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bet_id" TEXT NOT NULL,
    "selected_side" VARCHAR(50) NOT NULL,
    "parlay_id" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'selected',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_bet_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "token_type" VARCHAR(20) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "session_expire_idx" ON "session"("expire");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "games_external_id_key" ON "games"("external_id");

-- CreateIndex
CREATE INDEX "games_start_time_idx" ON "games"("start_time");

-- CreateIndex
CREATE INDEX "games_status_idx" ON "games"("status");

-- CreateIndex
CREATE INDEX "bets_game_id_idx" ON "bets"("game_id");

-- CreateIndex
CREATE INDEX "bets_outcome_idx" ON "bets"("outcome");

-- CreateIndex
CREATE INDEX "bets_visible_from_idx" ON "bets"("visible_from");

-- CreateIndex
CREATE INDEX "parlays_user_id_status_idx" ON "parlays"("user_id", "status");

-- CreateIndex
CREATE INDEX "parlays_last_game_end_time_idx" ON "parlays"("last_game_end_time");

-- CreateIndex
CREATE INDEX "streak_history_user_id_created_at_idx" ON "streak_history"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_bet_selections_user_id_status_idx" ON "user_bet_selections"("user_id", "status");

-- CreateIndex
CREATE INDEX "user_bet_selections_bet_id_idx" ON "user_bet_selections"("bet_id");

-- CreateIndex
CREATE INDEX "user_bet_selections_parlay_id_idx" ON "user_bet_selections"("parlay_id");

-- CreateIndex
CREATE INDEX "user_bet_selections_user_id_bet_id_selected_side_idx" ON "user_bet_selections"("user_id", "bet_id", "selected_side");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_key" ON "auth_tokens"("token");

-- CreateIndex
CREATE INDEX "auth_tokens_token_idx" ON "auth_tokens"("token");

-- CreateIndex
CREATE INDEX "auth_tokens_user_id_idx" ON "auth_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parlays" ADD CONSTRAINT "parlays_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_history" ADD CONSTRAINT "streak_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_history" ADD CONSTRAINT "streak_history_parlay_id_fkey" FOREIGN KEY ("parlay_id") REFERENCES "parlays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_bet_selections" ADD CONSTRAINT "user_bet_selections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_bet_selections" ADD CONSTRAINT "user_bet_selections_bet_id_fkey" FOREIGN KEY ("bet_id") REFERENCES "bets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_bet_selections" ADD CONSTRAINT "user_bet_selections_parlay_id_fkey" FOREIGN KEY ("parlay_id") REFERENCES "parlays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

