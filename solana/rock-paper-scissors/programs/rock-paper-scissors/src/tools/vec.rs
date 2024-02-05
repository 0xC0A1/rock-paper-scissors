/// Converts a Vec into an array of length N.
///
/// ### Panics
///
/// Panics if the length of the Vec is not N.
///
/// ### Example
///
/// ```
/// use rock_paper_scissors::tools::vec::vec_to_arr_of_n;
///
/// let v = vec![1, 2, 3, 4, 5];
/// let a: [u8; 5] = vec_to_arr_of_n(v);
/// assert_eq!(a, [1, 2, 3, 4, 5]);
/// ```
pub fn vec_to_arr_of_n<T, const N: usize>(v: Vec<T>) -> [T; N] {
    v.try_into()
        .unwrap_or_else(|v: Vec<T>| panic!("Expected a Vec of length {} but it was {}", N, v.len()))
}
