use anchor_lang::prelude::*;

#[account]
pub struct Settings {
    pub bump: u8,
    pub time_for_penalization: i64,
    pub time_for_stale: i64,
    pub treasury: Pubkey,
    pub player_fee_lamports: u64,
}

impl Settings {
    pub fn size() -> usize {
        8 + // Discriminator
        1 + // bump
        8 + // time_for_penalization
        8 + // time_for_stale
        32 + // treasury
        8 // player_fee_lamports
    }

    pub fn new(
        bump: u8,
        time_for_penalization: i64,
        time_for_stale: i64,
        treasury: Pubkey,
        player_fee_lamports: u64,
    ) -> Self {
        Self {
            bump,
            time_for_penalization,
            time_for_stale,
            treasury,
            player_fee_lamports,
        }
    }
}
