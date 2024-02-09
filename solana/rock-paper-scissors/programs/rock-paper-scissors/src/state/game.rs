use anchor_lang::prelude::*;

use crate::{error::RockPaperScissorsError, Settings};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum Player {
    First,
    Second,
}

impl Player {
    pub fn from_game(game: &Game, key: &Pubkey) -> Result<Self> {
        if &game.first_player == key {
            Ok(Self::First)
        } else if game.second_player.as_ref() == Some(key) {
            Ok(Self::Second)
        } else {
            Err(RockPaperScissorsError::AccountIsNotAPlayerInTheGame.into())
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum Choice {
    Rock,
    Paper,
    Scissors,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum GameState {
    Created,
    Started,
    FirstPlayerWon,
    SecondPlayerWon,
    Draw,
}

#[account]
pub struct Game {
    pub bump: u8,
    pub game_id: String,
    pub mint: Pubkey,
    pub token_program: Pubkey,

    pub amount_to_match: u64,

    pub first_player: Pubkey,
    pub first_player_hash: [u8; 32],
    pub first_player_escrow: Pubkey,
    pub first_player_choice: Option<Choice>,
    pub first_player_revealed_at: Option<i64>,

    pub second_player: Option<Pubkey>,
    pub second_player_hash: Option<[u8; 32]>,
    pub second_player_escrow: Option<Pubkey>,
    pub second_player_choice: Option<Choice>,
    pub second_player_revealed_at: Option<i64>,

    pub amount_won: Option<u64>,
    pub drawn_at: Option<i64>,

    pub state: GameState,
    pub created_at: i64,
}

impl Game {
    pub fn size() -> usize {
        8 + // Discriminator
        1 + // Bump
        (4 + 32) + // Game ID
        32 + // Mint
        32 + // Token program
        8 + // Amount to match

        32 + // First player
        32 + // First player hash
        32 + // First player escrow
        (1 + 1) + // First player choice
        (1 + 8) + // First player revealed at

        (1 + 32) + // Second player
        (1 + 32) + // Second player hash
        (1 + 32) + // Second player escrow
        (1 + 1) + // Second player choice
        (1 + 8) + // Second player revealed at

        (1 + 8) + // Amount won
        (1 + 8) + // Drawn at

        1 + // State
        8 // Created at
    }

    pub fn new(
        bump: u8,
        game_id: String,
        mint: Pubkey,
        token_program: Pubkey,
        amount_to_match: u64,
        first_player: Pubkey,
        first_player_hash: [u8; 32],
        first_player_escrow: Pubkey,
        created_at: i64,
    ) -> Self {
        Self {
            bump,
            game_id,
            mint,
            token_program,
            amount_to_match,

            first_player,
            first_player_hash,
            first_player_escrow,
            first_player_choice: None,
            first_player_revealed_at: None,

            second_player: None,
            second_player_hash: None,
            second_player_escrow: None,
            second_player_choice: None,
            second_player_revealed_at: None,

            amount_won: None,
            drawn_at: None,

            state: GameState::Created,
            created_at,
        }
    }

    pub fn join_game(
        &mut self,
        second_player: Pubkey,
        second_player_hash: [u8; 32],
        second_player_escrow: Pubkey,
    ) {
        self.second_player = Some(second_player);
        self.second_player_hash = Some(second_player_hash);
        self.second_player_escrow = Some(second_player_escrow);
        self.state = GameState::Started;
    }

    pub fn set_player_choice(&mut self, player: Player, choice: Choice, revealed_at: i64) {
        match player {
            Player::First => {
                self.first_player_choice = Some(choice);
                self.first_player_revealed_at = Some(revealed_at);
            }
            Player::Second => {
                self.second_player_choice = Some(choice);
                self.second_player_revealed_at = Some(revealed_at);
            }
        }
    }

    pub fn did_player_forfeit(&self, player: Player, now: i64, time_for_penalization: i64) -> bool {
        let (player_revealed_at, adversary_revealed_at) = match player {
            Player::First => (
                self.first_player_revealed_at,
                self.second_player_revealed_at,
            ),
            Player::Second => (
                self.second_player_revealed_at,
                self.first_player_revealed_at,
            ),
        };

        // This player revealed, can't count as a forfeit.
        if player_revealed_at.is_some() {
            return false;
        }

        // Neither player has revealed, so no forfeit.
        if player_revealed_at.is_none() && adversary_revealed_at.is_none() {
            return false;
        }

        // This player didn't reveal, but the adversary did, so forfeit
        // after the time for expiry.
        adversary_revealed_at.unwrap() + time_for_penalization <= now
    }

    pub fn set_claimed(&mut self, winner: &Option<Player>, amount_won: u64, now: i64) {
        self.state = match winner {
            Some(winner) => match winner {
                Player::First => GameState::FirstPlayerWon,
                Player::Second => GameState::SecondPlayerWon,
            },
            None => GameState::Draw,
        };
        if winner.is_some() {
            self.amount_won = Some(amount_won);
        }
        self.drawn_at = Some(now);
    }

    pub fn is_stale(&self, now: i64, time_for_stale: i64) -> bool {
        let no_player_revealed = self.state == GameState::Started
            && self.first_player_revealed_at.is_none()
            && self.second_player_revealed_at.is_none();
        no_player_revealed && self.created_at + time_for_stale > now
    }

    pub fn is_player(&self, key: &Pubkey) -> bool {
        self.first_player == *key || self.second_player.as_ref() == Some(key)
    }

    pub fn to_player(&self, key: &Pubkey) -> Result<Player> {
        if self.first_player == *key {
            Ok(Player::First)
        } else if self.second_player.as_ref() == Some(key) {
            Ok(Player::Second)
        } else {
            Err(RockPaperScissorsError::InvalidPlayer.into())
        }
    }

    pub fn get_winner(&self, now: i64, settings: &Settings) -> Result<Option<Player>> {
        require!(
            self.state == GameState::Started,
            RockPaperScissorsError::InvalidGameState
        );

        let did_first_player_forfeit =
            self.did_player_forfeit(Player::First, now, settings.time_for_penalization);
        if did_first_player_forfeit {
            msg!("First player forfeited due to time elapsed. Second player wins.");
            return Ok(Some(Player::Second));
        }

        let did_second_player_forfeit =
            self.did_player_forfeit(Player::Second, now, settings.time_for_penalization);
        if did_second_player_forfeit {
            msg!("Second player forfeited due to time elapsed. First player wins.");
            return Ok(Some(Player::First));
        }

        let first_player_choice = self.first_player_choice.as_ref().unwrap();
        let second_player_choice = self.second_player_choice.as_ref().unwrap();

        if first_player_choice == second_player_choice {
            return Ok(None);
        }

        let first_player_wins = match first_player_choice {
            Choice::Rock => second_player_choice == &Choice::Scissors,
            Choice::Paper => second_player_choice == &Choice::Rock,
            Choice::Scissors => second_player_choice == &Choice::Paper,
        };

        if first_player_wins {
            msg!(
                "First player wins with {:?} against {:?}",
                first_player_choice,
                second_player_choice
            );
            Ok(Some(Player::First))
        } else {
            msg!(
                "Second player wins with {:?} against {:?}",
                second_player_choice,
                first_player_choice
            );
            Ok(Some(Player::Second))
        }
    }
}
