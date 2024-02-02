use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{
    error::RockPaperScissorsError, transfer_lamports, transfer_spl_compatible, Game, Settings,
    GAME, GAME_ESCROW,
};

#[derive(Accounts)]
pub struct JoinGame<'info> {
    #[account(
        mut,
        seeds = [GAME.as_ref(), player.key().as_ref(), game.game_id.as_bytes()],
        bump = game.bump,
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
    #[account(
        mut,
        constraint = player.key() != game.first_player @ RockPaperScissorsError::BothPlayersCantBeTheSame
    )]
    pub player: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn processor(
    ctx: Context<JoinGame>,
    hash: [u8; 32], // Choice + Salt
) -> Result<()> {
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
        game.staked_amount,
        None,
    )?;
    transfer_lamports(
        system_program,
        ctx.accounts.player.to_account_info(),
        ctx.accounts.treasury.to_account_info(),
        game.staked_amount,
    )?;

    game.join_game(player.key(), hash, player_escrow_token_account.key());

    Ok(())
}
