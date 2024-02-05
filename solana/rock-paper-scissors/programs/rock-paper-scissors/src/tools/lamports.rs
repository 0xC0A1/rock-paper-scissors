use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction},
};

pub struct TransferLamports<'info> {
    /// CHECK: Cpi Checked.
    pub from: AccountInfo<'info>,
    /// CHECK: Cpi Checked.
    pub to: AccountInfo<'info>,
    /// CHECK: Cpi Checked.
    pub system_program: AccountInfo<'info>,
}

pub fn transfer_lamports<'info>(
    TransferLamports {
        from,
        to,
        system_program,
    }: TransferLamports<'info>,
    amount: u64,
) -> Result<()> {
    invoke(
        &system_instruction::transfer(&from.key(), &to.key(), amount),
        &[from, to, system_program.to_account_info()],
    )?;
    Ok(())
}
