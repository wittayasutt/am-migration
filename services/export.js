module.exports = {
	test(connection) {
		return new Promise((resolve, reject) => {
			connection.query('SELECT * FROM test', (err, rows, fields) => {
				if (!err) {
					resolve(rows)
				} else {
					reject(err)
				}
			})
		})
	}
}
