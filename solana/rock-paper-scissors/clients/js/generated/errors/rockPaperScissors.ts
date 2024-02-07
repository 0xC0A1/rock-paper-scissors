/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { Program, ProgramError } from '@metaplex-foundation/umi';

type ProgramErrorConstructor = new (
  program: Program,
  cause?: Error
) => ProgramError;
const codeToErrorMap: Map<number, ProgramErrorConstructor> = new Map();
const nameToErrorMap: Map<string, ProgramErrorConstructor> = new Map();

/** CustomError: Custom error message */
export class CustomErrorError extends ProgramError {
  override readonly name: string = 'CustomError';

  readonly code: number = 0x1770; // 6000

  constructor(program: Program, cause?: Error) {
    super('Custom error message', program, cause);
  }
}
codeToErrorMap.set(0x1770, CustomErrorError);
nameToErrorMap.set('CustomError', CustomErrorError);

/** AccountIsNotAPlayerInTheGame: Account is not a player in the game */
export class AccountIsNotAPlayerInTheGameError extends ProgramError {
  override readonly name: string = 'AccountIsNotAPlayerInTheGame';

  readonly code: number = 0x1771; // 6001

  constructor(program: Program, cause?: Error) {
    super('Account is not a player in the game', program, cause);
  }
}
codeToErrorMap.set(0x1771, AccountIsNotAPlayerInTheGameError);
nameToErrorMap.set(
  'AccountIsNotAPlayerInTheGame',
  AccountIsNotAPlayerInTheGameError
);

/** InvalidGameState: Invalid game state */
export class InvalidGameStateError extends ProgramError {
  override readonly name: string = 'InvalidGameState';

  readonly code: number = 0x1772; // 6002

  constructor(program: Program, cause?: Error) {
    super('Invalid game state', program, cause);
  }
}
codeToErrorMap.set(0x1772, InvalidGameStateError);
nameToErrorMap.set('InvalidGameState', InvalidGameStateError);

/** InvalidPlayer: Invalid player */
export class InvalidPlayerError extends ProgramError {
  override readonly name: string = 'InvalidPlayer';

  readonly code: number = 0x1773; // 6003

  constructor(program: Program, cause?: Error) {
    super('Invalid player', program, cause);
  }
}
codeToErrorMap.set(0x1773, InvalidPlayerError);
nameToErrorMap.set('InvalidPlayer', InvalidPlayerError);

/** InvalidHash: Invalid hash */
export class InvalidHashError extends ProgramError {
  override readonly name: string = 'InvalidHash';

  readonly code: number = 0x1774; // 6004

  constructor(program: Program, cause?: Error) {
    super('Invalid hash', program, cause);
  }
}
codeToErrorMap.set(0x1774, InvalidHashError);
nameToErrorMap.set('InvalidHash', InvalidHashError);

/** BothPlayersCantBeTheSame: Both players can't be the same */
export class BothPlayersCantBeTheSameError extends ProgramError {
  override readonly name: string = 'BothPlayersCantBeTheSame';

  readonly code: number = 0x1775; // 6005

  constructor(program: Program, cause?: Error) {
    super("Both players can't be the same", program, cause);
  }
}
codeToErrorMap.set(0x1775, BothPlayersCantBeTheSameError);
nameToErrorMap.set('BothPlayersCantBeTheSame', BothPlayersCantBeTheSameError);

/** GameIsNotStale: Game is not stale */
export class GameIsNotStaleError extends ProgramError {
  override readonly name: string = 'GameIsNotStale';

  readonly code: number = 0x1776; // 6006

  constructor(program: Program, cause?: Error) {
    super('Game is not stale', program, cause);
  }
}
codeToErrorMap.set(0x1776, GameIsNotStaleError);
nameToErrorMap.set('GameIsNotStale', GameIsNotStaleError);

/** PlayerAlreadyRevealed: Player already revealed */
export class PlayerAlreadyRevealedError extends ProgramError {
  override readonly name: string = 'PlayerAlreadyRevealed';

  readonly code: number = 0x1777; // 6007

  constructor(program: Program, cause?: Error) {
    super('Player already revealed', program, cause);
  }
}
codeToErrorMap.set(0x1777, PlayerAlreadyRevealedError);
nameToErrorMap.set('PlayerAlreadyRevealed', PlayerAlreadyRevealedError);

/** NumericOverflow: Numeric overflow */
export class NumericOverflowError extends ProgramError {
  override readonly name: string = 'NumericOverflow';

  readonly code: number = 0x1778; // 6008

  constructor(program: Program, cause?: Error) {
    super('Numeric overflow', program, cause);
  }
}
codeToErrorMap.set(0x1778, NumericOverflowError);
nameToErrorMap.set('NumericOverflow', NumericOverflowError);

/**
 * Attempts to resolve a custom program error from the provided error code.
 * @category Errors
 */
export function getRockPaperScissorsErrorFromCode(
  code: number,
  program: Program,
  cause?: Error
): ProgramError | null {
  const constructor = codeToErrorMap.get(code);
  return constructor ? new constructor(program, cause) : null;
}

/**
 * Attempts to resolve a custom program error from the provided error name, i.e. 'Unauthorized'.
 * @category Errors
 */
export function getRockPaperScissorsErrorFromName(
  name: string,
  program: Program,
  cause?: Error
): ProgramError | null {
  const constructor = nameToErrorMap.get(name);
  return constructor ? new constructor(program, cause) : null;
}
