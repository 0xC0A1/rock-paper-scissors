use anchor_lang::prelude::*;

use crate::error::RockPaperScissorsError;

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

    pub staked_amount: u64,

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
        8 + // Staked amount

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
        staked_amount: u64,
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
            staked_amount,

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

    pub fn did_player_forfeit(&self, player: Player, now: i64, time_for_expiry: i64) -> bool {
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
        adversary_revealed_at.unwrap() + time_for_expiry < now
    }

    pub fn set_claimed(&mut self, winner: Player, amount_won: u64, now: i64) {
        self.amount_won = Some(amount_won);
        self.state = match winner {
            Player::First => GameState::FirstPlayerWon,
            Player::Second => GameState::SecondPlayerWon,
        };
        self.drawn_at = Some(now);
    }
}
