import bs58 from "bs58";
import { getRandomValues, subtle } from "crypto";
import { Choice } from "./choice";

/**
 * Creates a 32 byte salt
 *
 * @returns {Uint8Array} - 32 byte salt
 */
export const getSalt = (): Uint8Array => getRandomValues(new Uint8Array(32));

export class GetHashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GetHashError";
  }
  static invalidLength() {
    return new GetHashError("Invalid length");
  }
}

/**
 * Returns a 32 byte hash of the choice and salt
 *
 * @param {Choice} choice - 0: Rock, 1: Paper, 2: Scissors
 * @param {Uint8Array} salt - 32 byte salt
 * @returns {Promise<Uint8Array>} - 32 byte hash
 */
export const getHashedSaltAndChoice = async (
  choice: Choice,
  salt: Uint8Array
): Promise<Uint8Array> => {
  const totalBytes = new Uint8Array([choice, ...salt]);
  if (totalBytes.length !== 33) throw GetHashError.invalidLength();
  return new Uint8Array(await subtle.digest("SHA-256", totalBytes));
};
