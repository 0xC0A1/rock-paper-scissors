use anchor_lang::{
    prelude::*,
    solana_program::hash::{hashv, Hash},
};

use crate::{
    error::RockPaperScissorsError, vec_to_arr_of_n, Choice, Game, GameState, Player, GAME,
};

#[derive(Accounts)]
pub struct RevealChoice<'info> {
    #[account(
        mut,
        close = player,
        seeds = [GAME.as_ref(), player.key().as_ref(), game.game_id.as_bytes()],
        bump = game.bump,
        constraint = game.state == GameState::Started @ RockPaperScissorsError::InvalidGameState,
    )]
    pub game: Account<'info, Game>,
    #[account(
        constraint = game.is_player(&player.key()) @ RockPaperScissorsError::InvalidPlayer,
    )]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

fn require_player_did_not_reveal(player: &Player, game: &Game) -> Result<()> {
    match player {
        Player::First => {
            require!(
                game.first_player_choice.is_none(),
                RockPaperScissorsError::PlayerAlreadyRevealed
            );
        }
        Player::Second => {
            require!(
                game.second_player_choice.is_none(),
                RockPaperScissorsError::PlayerAlreadyRevealed
            );
        }
    }
    Ok(())
}

pub fn processor(ctx: Context<RevealChoice>, choice: Choice, salt: [u8; 32]) -> Result<()> {
    let clock = Clock::get()?;
    let game = &mut ctx.accounts.game;

    let choice_bytes = choice.clone() as u8;
    let player_key = ctx.accounts.player.key();

    let player = game.to_player(&player_key)?;

    require_player_did_not_reveal(&player, game)?;

    let val_to_hash = vec_to_arr_of_n::<u8, 33>([&[choice_bytes], &salt[..]].concat());
    let created_hash = hashv(&[&val_to_hash]);
    let stored_hash = Hash::new_from_array(match player {
        Player::First => game.first_player_hash,
        Player::Second => game.second_player_hash.unwrap(),
    });

    require_eq!(
        created_hash,
        stored_hash,
        RockPaperScissorsError::InvalidHash
    );

    game.set_player_choice(player, choice, clock.unix_timestamp);

    Ok(())
}
