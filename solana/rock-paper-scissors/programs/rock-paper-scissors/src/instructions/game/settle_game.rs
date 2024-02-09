use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    close_account, CloseAccount, Mint, TokenAccount, TokenInterface,
};

use crate::{
    error::RockPaperScissorsError, transfer_spl_compatible, Game, GameState, Player, Settings,
    GAME, GAME_ESCROW, SETTINGS,
};

#[derive(Accounts)]
pub struct SettleGame<'info> {
    #[account(
        mut,
        seeds = [
            GAME.as_ref(),
            game.first_player.as_ref(),
            game.game_id.as_bytes()
        ],
        bump = game.bump,
        constraint = game.state == GameState::Started @ RockPaperScissorsError::InvalidGameState,
    )]
    pub game: Box<Account<'info, Game>>,
    #[account(
        seeds = [SETTINGS.as_ref()],
        bump = settings.bump,
    )]
    pub settings: Account<'info, Settings>,

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

    pub signer: Signer<'info>,

    #[account(address = game.token_program)]
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn processor(ctx: Context<SettleGame>) -> Result<()> {
    let clock = Clock::get()?;
    let game = &mut ctx.accounts.game;
    let settings = &ctx.accounts.settings;
    let mint = &ctx.accounts.mint;
    let token_program = &ctx.accounts.token_program;

    let first_player_escrow_token_account = &mut ctx.accounts.first_player_escrow_token_account;
    let first_player_token_account = &mut ctx.accounts.first_player_token_account;
    let second_player_escrow_token_account = &mut ctx.accounts.second_player_escrow_token_account;
    let second_player_token_account = &mut ctx.accounts.second_player_token_account;

    let first_player_key = ctx.accounts.first_player.key();
    let now = clock.unix_timestamp;

    let game_seeds = &[
        GAME.as_ref(),
        first_player_key.as_ref(),
        game.game_id.as_bytes(),
        &[game.bump],
    ];
    let game_signer = &[&game_seeds[..]];

    let winner = game.get_winner(now, settings)?;

    if winner.is_none() {
        transfer_spl_compatible(
            token_program,
            first_player_escrow_token_account,
            first_player_token_account,
            &game.to_account_info(),
            mint,
            game.amount_to_match,
            Some(game_signer),
        )?;
        transfer_spl_compatible(
            token_program,
            second_player_escrow_token_account,
            second_player_token_account,
            &game.to_account_info(),
            mint,
            game.amount_to_match,
            Some(game_signer),
        )?;
    } else {
        let winner = winner.as_ref().unwrap();
        let (
            winner_escrow_token_account,
            winner_token_account,
            loser_escrow_token_account,
            _loser_token_account,
        ) = match winner {
            Player::First => (
                first_player_escrow_token_account,
                first_player_token_account,
                second_player_escrow_token_account,
                second_player_token_account,
            ),
            Player::Second => (
                second_player_escrow_token_account,
                second_player_token_account,
                first_player_escrow_token_account,
                first_player_token_account,
            ),
        };
        transfer_spl_compatible(
            token_program,
            winner_escrow_token_account,
            winner_token_account,
            &game.to_account_info(),
            mint,
            game.amount_to_match,
            Some(game_signer),
        )?;
        transfer_spl_compatible(
            token_program,
            loser_escrow_token_account,
            winner_token_account,
            &game.to_account_info(),
            mint,
            game.amount_to_match,
            Some(game_signer),
        )?;
    }

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

    let amount_won: u64 = match winner {
        Some(_) => match game.amount_to_match.checked_mul(2) {
            Some(value) => value,
            None => return Err(RockPaperScissorsError::NumericOverflow.into()),
        },
        None => 0,
    };

    game.set_claimed(&winner, amount_won, now);

    Ok(())
}
