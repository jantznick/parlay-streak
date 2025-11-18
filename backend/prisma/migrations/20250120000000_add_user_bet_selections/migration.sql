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

-- CreateIndex
CREATE INDEX "user_bet_selections_user_id_status_idx" ON "user_bet_selections"("user_id", "status");

-- CreateIndex
CREATE INDEX "user_bet_selections_bet_id_idx" ON "user_bet_selections"("bet_id");

-- CreateIndex
CREATE INDEX "user_bet_selections_parlay_id_idx" ON "user_bet_selections"("parlay_id");

-- CreateIndex
CREATE INDEX "user_bet_selections_user_id_bet_id_selected_side_idx" ON "user_bet_selections"("user_id", "bet_id", "selected_side");

-- AddForeignKey
ALTER TABLE "user_bet_selections" ADD CONSTRAINT "user_bet_selections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_bet_selections" ADD CONSTRAINT "user_bet_selections_bet_id_fkey" FOREIGN KEY ("bet_id") REFERENCES "bets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_bet_selections" ADD CONSTRAINT "user_bet_selections_parlay_id_fkey" FOREIGN KEY ("parlay_id") REFERENCES "parlays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

