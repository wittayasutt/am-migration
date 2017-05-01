module.exports = {
	getComments(connection) {
		return new Promise((resolve, reject) => {
			connection.query('SELECT * FROM wp_comments', (err, rows, fields) => {
				if (!err) {
					resolve(rows)
				} else {
					reject(err)
				}
			})
		})
	},

	getProfileData(connection) {
		return new Promise((resolve, reject) => {
			connection.query('SELECT * FROM wp_bp_xprofile_data', (err, rows, fields) => {
				if (!err) {
					resolve(rows)
				} else {
					reject(err)
				}
			})
		})
	},

	getProfileFields(connection) {
		return new Promise((resolve, reject) => {
			connection.query('SELECT * FROM wp_bp_xprofile_fields', (err, rows, fields) => {
				if (!err) {
					resolve(rows)
				} else {
					reject(err)
				}
			})
		})
	},

	getPosts(connection) {
		return new Promise((resolve, reject) => {
			connection.query('SELECT * FROM wp_posts', (err, rows, fields) => {
				if (!err) {
					resolve(rows)
				} else {
					reject(err)
				}
			})
		})
	},

	getPostMeta(connection) {
		return new Promise((resolve, reject) => {
			connection.query('SELECT * FROM wp_postmeta', (err, rows, fields) => {
				if (!err) {
					resolve(rows)
				} else {
					reject(err)
				}
			})
		})
	},

	getUserMeta(connection) {
		return new Promise((resolve, reject) => {
			connection.query('SELECT * FROM wp_usermeta', (err, rows, fields) => {
				if (!err) {
					resolve(rows)
				} else {
					reject(err)
				}
			})
		})
	},

	getUsers(connection) {
		return new Promise((resolve, reject) => {
			connection.query('SELECT * FROM wp_users', (err, rows, fields) => {
				if (!err) {
					resolve(rows)
				} else {
					reject(err)
				}
			})
		})
	}
}
