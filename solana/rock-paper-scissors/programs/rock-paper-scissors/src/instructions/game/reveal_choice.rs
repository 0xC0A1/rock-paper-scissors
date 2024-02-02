use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RevealChoice {}

pub fn processor(_ctx: Context<RevealChoice>) -> Result<()> {
    Ok(())
}
