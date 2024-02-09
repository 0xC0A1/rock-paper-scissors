use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    close_account, CloseAccount, Mint, TokenAccount, TokenInterface,
};

use crate::{
    error::RockPaperScissorsError, transfer_spl_compatible, Game, GameState, GAME, GAME_ESCROW,
};

#[derive(Accounts)]
pub struct CancelGame<'info> {
    #[account(
        mut,
        close = player,
        seeds = [GAME.as_ref(), player.key().as_ref(), game.game_id.as_bytes()],
        bump = game.bump,
        constraint = game.state == GameState::Created @ RockPaperScissorsError::InvalidGameState,
    )]
    pub game: Account<'info, Game>,
    #[account(
        mut,
        // close = player, // Commented out since this is closed via CPI call
        token::mint = mint,
        token::authority = game,
        token::token_program = token_program,
        seeds = [
            GAME_ESCROW.as_ref(),
            game.key().as_ref(),
            player.key().as_ref(),
        ],
        bump,
    )]
    pub player_escrow_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = player,
        token::token_program = token_program
    )]
    pub player_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mint::token_program = token_program,
        address = game.mint
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(address = game.token_program)]
    pub token_program: Interface<'info, TokenInterface>,
    #[account(
        mut,
        address = game.first_player @ RockPaperScissorsError::InvalidPlayer,
    )]
    pub player: Signer<'info>,
}

pub fn processor(ctx: Context<CancelGame>) -> Result<()> {
    let player = &ctx.accounts.player;
    let game = &ctx.accounts.game;
    let player_key = player.key();

    let game_seeds = &[
        GAME.as_ref(),
        player_key.as_ref(),
        ctx.accounts.game.game_id.as_bytes(),
        &[game.bump],
    ];
    let game_signer = &[&game_seeds[..]];

    transfer_spl_compatible(
        &ctx.accounts.token_program,
        &mut ctx.accounts.player_escrow_token_account,
        &mut ctx.accounts.player_token_account,
        &game.to_account_info(),
        &ctx.accounts.mint,
        game.amount_to_match,
        Some(game_signer),
    )?;

    close_account(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.player_escrow_token_account.to_account_info(),
                destination: ctx.accounts.player.to_account_info(),
                authority: ctx.accounts.game.to_account_info(),
            },
        )
        .with_signer(game_signer),
    )?;

    Ok(())
}
