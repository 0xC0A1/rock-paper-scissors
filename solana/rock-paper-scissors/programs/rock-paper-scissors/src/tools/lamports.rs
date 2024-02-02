use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction},
};

pub fn transfer_lamports<'info>(
    system_program: &Program<'info, System>,
    from: AccountInfo<'info>,
    to: AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    invoke(
        &system_instruction::transfer(&from.key(), &to.key(), amount),
        &[from, to, system_program.to_account_info()],
    )?;
    Ok(())
}
