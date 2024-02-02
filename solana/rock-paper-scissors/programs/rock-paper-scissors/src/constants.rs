use anchor_lang::prelude::*;

#[constant]
pub const SETTINGS: [u8; 8] = *b"settings";

#[constant]
pub const GAME: [u8; 4] = *b"game";
#[constant]
pub const GAME_ESCROW: [u8; 11] = *b"game_escrow";
#[constant]
pub const FIRST_PLAYER: [u8; 12] = *b"first_player";
#[constant]
pub const SECOND_PLAYER: [u8; 13] = *b"second_player";