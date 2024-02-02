use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializeSettings {}

pub fn processor(_ctx: Context<InitializeSettings>) -> Result<()> {
    Ok(())
}
