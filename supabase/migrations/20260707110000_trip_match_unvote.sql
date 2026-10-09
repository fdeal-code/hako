-- ═════════════════════════════════════════════════════════════
-- HAKO — Trip Match : dé-vote
-- Requis par tripMatchService.unvoteProposal : un utilisateur peut
-- retirer son propre vote sur une proposition (toggle).
-- ═════════════════════════════════════════════════════════════

create policy "match_proposal_votes_delete_own"
  on public.match_proposal_votes for delete
  using (auth.uid() = user_id);
