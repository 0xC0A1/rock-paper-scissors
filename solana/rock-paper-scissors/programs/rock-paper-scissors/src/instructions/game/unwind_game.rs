use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    close_account, CloseAccount, Mint, TokenAccount, TokenInterface,
};

use crate::{
    error::RockPaperScissorsError, transfer_spl_compatible, Game, GameState, Settings, GAME,
    GAME_ESCROW, SETTINGS,
};

#[derive(Accounts)]
pub struct UnwindGame<'info> {
    #[account(
        mut,
        close = first_player,
        seeds = [GAME.as_ref(), first_player.key().as_ref(), game.game_id.as_bytes()],
        bump = game.bump,
        constraint = game.state == GameState::Started @ RockPaperScissorsError::InvalidGameState,
    )]
    pub game: Account<'info, Game>,

    #[account(
        mut,
        // close = first_player, // Commented out since this is closed via CPI call
        token::mint = mint,
        token::authority = game,
        token::token_program = token_program,
        seeds = [
            GAME_ESCROW.as_ref(),
            game.key().as_ref(),
            first_player.key().as_ref(),
        ],
        bump,
    )]
    pub first_player_escrow_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = first_player,
        token::token_program = token_program
    )]
    pub first_player_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: No check needed.
    #[account(
        mut,
        address = game.first_player
    )]
    pub first_player: AccountInfo<'info>,

    #[account(
        mut,
        // close = second_player, // Commented out since this is closed via CPI call
        token::mint = mint,
        token::authority = game,
        token::token_program = token_program,
        seeds = [
            GAME_ESCROW.as_ref(),
            game.key().as_ref(),
            second_player.key().as_ref(),
        ],
        bump,
    )]
    pub second_player_escrow_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = second_player,
        token::token_program = token_program
    )]
    pub second_player_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: No check needed.
    #[account(
        mut,
        // Unwrapping here is fine since the game is in the started state.
        address = game.second_player.unwrap()
    )]
    pub second_player: AccountInfo<'info>,

    #[account(
        mint::token_program = game.token_program,
        address = game.mint
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// Not checked, so this call is permissionless.
    pub signer: Signer<'info>,
    #[account(
        seeds = [SETTINGS.as_ref()],
        bump = settings.bump,
    )]
    pub settings: Account<'info, Settings>,

    #[account(address = game.token_program)]
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn processor(ctx: Context<UnwindGame>) -> Result<()> {
    let clock = Clock::get()?;
    let game = &mut ctx.accounts.game;
    let settings = &ctx.accounts.settings;
    let first_player_key = ctx.accounts.first_player.key();
    let first_player_escrow_token_account = &mut ctx.accounts.first_player_escrow_token_account;
    let first_player_token_account = &mut ctx.accounts.first_player_token_account;
    let second_player_escrow_token_account = &mut ctx.accounts.second_player_escrow_token_account;
    let second_player_token_account = &mut ctx.accounts.second_player_token_account;
    let mint = &ctx.accounts.mint;

    require!(
        game.is_stale(clock.unix_timestamp, settings.time_for_stale),
        RockPaperScissorsError::GameIsNotStale
    );

    let game_seeds = &[
        GAME.as_ref(),
        first_player_key.as_ref(),
        game.game_id.as_bytes(),
        &[game.bump],
    ];
    let game_signer = &[&game_seeds[..]];

    transfer_spl_compatible(
        &ctx.accounts.token_program,
        first_player_escrow_token_account,
        first_player_token_account,
        &game.to_account_info(),
        mint,
        game.amount_to_match,
        Some(game_signer),
    )?;
    transfer_spl_compatible(
        &ctx.accounts.token_program,
        second_player_escrow_token_account,
        second_player_token_account,
        &game.to_account_info(),
        mint,
        game.amount_to_match,
        Some(game_signer),
    )?;
    close_account(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx
                    .accounts
                    .first_player_escrow_token_account
                    .to_account_info(),
                destination: ctx.accounts.first_player.to_account_info(),
                authority: game.to_account_info(),
            },
        )
        .with_signer(game_signer),
    )?;
    close_account(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx
                    .accounts
                    .second_player_escrow_token_account
                    .to_account_info(),
                destination: ctx.accounts.second_player.to_account_info(),
                authority: game.to_account_info(),
            },
        )
        .with_signer(game_signer),
    )?;

    Ok(())
}
