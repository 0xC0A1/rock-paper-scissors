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

declare_id!("877CES5Ju3qoQJTCFqokCjcqjR6sFHEstfnqjqmvSXo4");

#[program]
pub mod rock_paper_scissors {
    use super::*;

    pub fn initialize_game(
        ctx: Context<InitializeGame>,
        game_id: String,
        amount: u64,
        hash: [u8; 32], // Choice + Salt
    ) -> Result<()> {
        initialize_game::processor(ctx, game_id, amount, hash)
    }
}
