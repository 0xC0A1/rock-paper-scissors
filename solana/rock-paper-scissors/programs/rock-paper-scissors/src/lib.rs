pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod tools;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;
pub use tools::*;

declare_id!("rock7uz5eZdz8fb1ZEfZ1aR428ncvkYBrgebwyzaqBG");

#[program]
pub mod rock_paper_scissors {
    use super::*;

    pub fn initialize_settings(
        ctx: Context<InitializeSettings>,
        time_for_penalization: i64,
        time_for_stale: i64,
        player_fee_lamports: u64,
    ) -> Result<()> {
        initialize_settings::processor(
            ctx,
            time_for_penalization,
            time_for_stale,
            player_fee_lamports,
        )
    }

    pub fn update_settings(
        ctx: Context<UpdateSettings>,
        time_for_penalization: i64,
        time_for_stale: i64,
        player_fee_lamports: u64,
    ) -> Result<()> {
        update_settings::processor(
            ctx,
            time_for_penalization,
            time_for_stale,
            player_fee_lamports,
        )
    }

    pub fn initialize_game(
        ctx: Context<InitializeGame>,
        game_id: String,
        amount: u64,
        hash: [u8; 32], // Choice + Salt
    ) -> Result<()> {
        initialize_game::processor(ctx, game_id, amount, hash)
    }

    pub fn join_game(
        ctx: Context<JoinGame>,
        hash: [u8; 32], // Choice + Salt
    ) -> Result<()> {
        join_game::processor(ctx, hash)
    }

    pub fn cancel_game(ctx: Context<CancelGame>) -> Result<()> {
        cancel_game::processor(ctx)
    }

    pub fn unwind_game(ctx: Context<UnwindGame>) -> Result<()> {
        unwind_game::processor(ctx)
    }

    pub fn reveal_choice(ctx: Context<RevealChoice>, choice: Choice, salt: [u8; 32]) -> Result<()> {
        reveal_choice::processor(ctx, choice, salt)
    }

    pub fn settle_game(ctx: Context<SettleGame>) -> Result<()> {
        settle_game::processor(ctx)
    }
}
