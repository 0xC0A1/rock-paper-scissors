use anchor_lang::{prelude::*, solana_program::pubkey};

use crate::{Settings, SETTINGS};

#[derive(Accounts)]
pub struct InitializeSettings<'info> {
    #[account(
        init,
        payer = signer,
        space = Settings::size(),
        seeds = [SETTINGS.as_ref()],
        bump,
    )]
    pub settings: Account<'info, Settings>,
    #[account(
        mut,
        address = pubkey!("11111111111111111111111111111111")
    )]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn processor(
    ctx: Context<InitializeSettings>,
    time_for_penalization: i64,
    time_for_stale: i64,
    game_fee_lamports: u64,
) -> Result<()> {
    let settings = &mut ctx.accounts.settings;
    let signer = &ctx.accounts.signer;
    let bump = ctx.bumps.settings;
    settings.set_inner(Settings::new(
        bump,
        time_for_penalization,
        time_for_stale,
        signer.key(),
        game_fee_lamports,
    ));
    Ok(())
}
