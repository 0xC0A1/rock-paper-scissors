use anchor_lang::prelude::*;

#[error_code]
pub enum RockPaperScissorsError {
    #[msg("Custom error message")]
    CustomError,
    #[msg("Account is not a player in the game")]
    AccountIsNotAPlayerInTheGame,
    #[msg("Invalid game state")]
    InvalidGameState,
    #[msg("Invalid player")]
    InvalidPlayer,
    #[msg("Invalid hash")]
    InvalidHash,
    #[msg("Both players can't be the same")]
    BothPlayersCantBeTheSame,
}
