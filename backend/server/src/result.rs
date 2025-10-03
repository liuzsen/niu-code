pub type BizResult<T, E> = Result<Result<T, E>, anyhow::Error>;

#[macro_export]
macro_rules! ensure_biz {
    ($result:expr) => {
        match $result {
            Ok(v) => v,
            Err(err) => return Ok(Err(From::from(err))),
        }
    };
}

#[macro_export]
macro_rules! biz_ok {
    ($result:expr) => {
        Ok(Ok($result))
    };
}
