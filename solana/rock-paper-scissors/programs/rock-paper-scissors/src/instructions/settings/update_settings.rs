use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateSettings {}

pub fn processor(_ctx: Context<UpdateSettings>) -> Result<()> {
    Ok(())
}
