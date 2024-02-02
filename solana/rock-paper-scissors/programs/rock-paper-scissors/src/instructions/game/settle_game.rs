use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct SettleGame {}

pub fn processor(_ctx: Context<SettleGame>) -> Result<()> {
    Ok(())
}
