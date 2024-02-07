use anchor_lang::prelude::*;

use crate::{Settings, SETTINGS};

#[derive(Accounts)]
pub struct UpdateSettings<'info> {
    #[account(
        mut,
        seeds = [SETTINGS.as_ref()],
        bump = settings.bump,
    )]
    pub settings: Account<'info, Settings>,
    #[account(
        mut,
        address = settings.treasury,
    )]
    pub signer: Signer<'info>,
}

pub fn processor(
    ctx: Context<UpdateSettings>,
    time_for_penalization: i64,
    time_for_stale: i64,
    player_fee_lamports: u64,
) -> Result<()> {
    let settings = &mut ctx.accounts.settings;
    settings.time_for_stale = time_for_stale;
    settings.time_for_penalization = time_for_penalization;
    settings.player_fee_lamports = player_fee_lamports;
    Ok(())
}
