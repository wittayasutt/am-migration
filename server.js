const { db } = require('./config')
const glob = require('glob')
const mysql = require('mysql')

let api = {}
let services = glob.sync('./services/*.js')
services.forEach(service => {
  const name = service.slice(11, -3)
  api[name] = require(service)
})

const connection = mysql.createConnection(db)
connection.connect()

api.import.getComments(connection).then((res) => {
  console.log('> Comments')
  console.log('Data size', res.length)
  // console.log('Data 0', res[0])
  console.log('')
})

api.import.getProfileData(connection).then((res) => {
  console.log('> Profile Data')
  console.log('Data size', res.length)
  // console.log('Data 0', res[0])
  console.log('')
})

api.import.getProfileFields(connection).then((res) => {
  console.log('> Profile Fields')
  console.log('Data size', res.length)
  // console.log('Data 0', res[0])
  console.log('')
})

api.import.getPosts(connection).then((res) => {
  console.log('> Posts')
  console.log('Data size', res.length)
  // console.log('Data 0', res[0])
  console.log('')
})

api.import.getPostMeta(connection).then((res) => {
  console.log('> Post Meta')
  console.log('Data size', res.length)
  // console.log('Data 0', res[0])
  console.log('')
})

api.import.getUserMeta(connection).then((res) => {
  console.log('> User Meta')
  console.log('Data size', res.length)
  // console.log('Data 0', res[0])
  console.log('')
})

api.import.getUsers(connection).then((res) => {
  console.log('> Users')
  console.log('Data size', res.length)
  // console.log('Data 0', res[0])
  console.log('')
})

connection.end()
