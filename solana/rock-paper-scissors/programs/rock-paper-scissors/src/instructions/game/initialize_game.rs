use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{transfer_lamports, transfer_spl_compatible, Game, Settings, GAME, GAME_ESCROW};

#[derive(Accounts)]
#[instruction(game_id: String)]
pub struct InitializeGame<'info> {
    #[account(
        init,
        payer = player,
        space = Game::size(),
        seeds = [GAME.as_ref(), player.key().as_ref(), game_id.as_bytes()],
        bump,
    )]
    pub game: Account<'info, Game>,
    #[account(
        init,
        token::mint = mint,
        token::authority = game,
        token::token_program = token_program,
        seeds = [
            GAME_ESCROW.as_ref(),
            game.key().as_ref(),
            player.key().as_ref(),
        ],
        bump,
        payer = player,
    )]
    pub player_escrow_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = player,
        token::token_program = token_program
    )]
    pub player_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK: No check needed.
    #[account(
        mut,
        address = settings.treasury
    )]
    pub treasury: AccountInfo<'info>,
    pub settings: Account<'info, Settings>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn processor(
    ctx: Context<InitializeGame>,
    game_id: String,
    amount: u64,
    hash: [u8; 32], // Choice + Salt
) -> Result<()> {
    let clock = Clock::get()?;
    let game = &mut ctx.accounts.game;
    let player = &ctx.accounts.player;
    let player_token_account = &mut ctx.accounts.player_token_account;
    let player_escrow_token_account = &mut ctx.accounts.player_escrow_token_account;
    let mint = &ctx.accounts.mint;
    let token_program = &ctx.accounts.token_program;
    let system_program = &ctx.accounts.system_program;

    let _hash = anchor_lang::solana_program::hash::Hash::new_from_array(hash);

    transfer_spl_compatible(
        token_program,
        player_token_account,
        player_escrow_token_account,
        player,
        mint,
        amount,
        None,
    )?;
    transfer_lamports(
        system_program,
        ctx.accounts.player.to_account_info(),
        ctx.accounts.treasury.to_account_info(),
        amount,
    )?;

    game.set_inner(Game::new(
        ctx.bumps.game,
        game_id,
        mint.key(),
        token_program.key(),
        amount,
        player.key(),
        hash,
        player_escrow_token_account.key(),
        clock.unix_timestamp,
    ));

    Ok(())
}
