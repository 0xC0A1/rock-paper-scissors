use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    spl_token_2022, transfer, transfer_checked, Mint, TokenAccount, TokenInterface, Transfer,
    TransferChecked,
};

pub fn transfer_spl_compatible<'info>(
    token_program: &Interface<'info, TokenInterface>,
    from: &mut Box<InterfaceAccount<'info, TokenAccount>>,
    to: &mut Box<InterfaceAccount<'info, TokenAccount>>,
    authority: &AccountInfo<'info>,
    mint: &Box<InterfaceAccount<'info, Mint>>,
    amount: u64,
    signer_seeds: Option<&[&[&[u8]]]>,
) -> Result<()> {
    if token_program.key() == spl_token_2022::ID {
        let ctx = CpiContext::new(
            token_program.to_account_info(),
            TransferChecked {
                from: from.to_account_info(),
                to: to.to_account_info(),
                authority: authority.to_account_info(),
                mint: mint.to_account_info(),
            },
        );
        if let Some(seeds) = signer_seeds {
            transfer_checked(ctx.with_signer(seeds), amount, mint.decimals)?;
        } else {
            transfer_checked(ctx, amount, mint.decimals)?;
        }
    } else {
        // Allow deprecated transfer for classic SPL Tokens.
        let ctx = CpiContext::new(
            token_program.to_account_info(),
            Transfer {
                authority: authority.to_account_info(),
                from: from.to_account_info(),
                to: to.to_account_info(),
            },
        );
        if let Some(seeds) = signer_seeds {
            #[allow(deprecated)]
            transfer(ctx.with_signer(seeds), amount)?;
        } else {
            #[allow(deprecated)]
            transfer(ctx, amount)?;
        }
    }
    Ok(())
}
