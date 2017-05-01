var mongoose = require('mongoose'),
	Schema = mongoose.Schema,
	autoInc = require('mongoose-auto-increment'),
	config = require('../config'),
  plugins = require('./plugins'),
  htmlToText = require('html-to-text'),
  setting = require('./setting'),
  validator = require('validator'),
  uniqueValidator = require('mongoose-unique-validator'),
  bcrypt = require('bcrypt'),
  helpers = require('./helpers'),
  {Fields, Cast, Populate} = require('./caster'),
  {NotFoundError, Errors} = require('../error'),
  {Valid} = require('../i18n/en/message'),
  ObjectId = Schema.Types.ObjectId,
  moment = require('moment'),
  round = require('mongo-round')

Promise = mongoose.Promise = require('bluebird')

const ROLES = setting.ROLES

let connection = mongoose.connection || mongoose.connect(config.DB.HOST)
autoInc.initialize(connection)

//===========================

// let roleSchema = new Schema({
//   type: {
//     type:Number,
//     min:0,
//     max: ROLES.length,
//     required: [true, 'Role type must be specified.']
//   },

//   user: {
//     type:Number,
//     ref:'User',
//     required: [true, 'A role must related to user.']
//   },

//   kind: {
//     type: String,
//     required: [true, 'A role must have "kind".']
//   },
//   kindOf: {
//     type: Number,
//     refPath: 'kind',
//     required:[true, 'A role must have "kindOf".']
//   }
// })

let userSchema = new Schema({
  email: {
    type:String,
    trim: true,
    required: [true, 'Email is required.'],
    unique: true,
    index: true,
    validate: {
      validator: function(v){
        return validator.isEmail(v)
      },
      message: '{VALUE} is not a valid email.'
    }
  },
  // firstname: {
  //   type: String,
  //   trim: true,
  //   maxlength: setting.NAME_MAX_LENGTH
  // },
  // lastname: {
  //   type: String,
  //   trim: true,
  //   maxlength: setting.NAME_MAX_LENGTH
  // },
  display: {
    type: String,
    trim: true,
    maxlength: setting.NAME_MAX_LENGTH
  },
  // hashed
  password: {
    type:String,
    //maxlength: setting.NAME_MAX_LENGTH,
    required: [true ,'Password is required.'],
    //trim: true,
    // validate: {
    //   validator: function(v){
    //     // at least 6 chars pwd
    //     return (v.length >= 6)
    //   },
    //   message: 'Password must be at least 6 characters.'
    // }
  },
  username:  {
    type:String,
    trim: true,
    //required: [true ,'Username is required.'],  // can access via id instead of username
    unique: true,
    sparse: true,
    index: true,
    lowercase: true,
    maxlength: setting.NAME_MAX_LENGTH,
    validate: {
      validator: function(v){
        if(v==='') return false // disallow empty string
        // - Only one special char (._-) allowed and it must not be at the extremas of the string
        // - The first character cannot be a number
        // - All the other characters allowed are letters and numbers
        return /^[a-zA-Z][a-zA-Z0-9]*[._-]?[a-zA-Z0-9]+$/.test(v)
      },
      message: '{VALUE} is not a valid username!'
    }
  },
  shortDesc: {
    type: String,
    trim: true,
    maxlength: setting.SHORTDESC_LENGTH
  },
  facebook: {
    id: String,
    email: String,
    token: String
  },

  //pic filename+ext
  // _photo: {
  //   type: String,
  //   trim: true
  // },
  _photo: Schema.Types.Mixed, //{small: 'picname', medium: 'picname'}

  // Whether this user need to reload cookie
  // reloadCookie: {
  //   type: Boolean,
  //   default: false
  // },

  // used when casting this doc
  url: String,

  //ex : user.roles = [{type:ROLES.MEMBER, kind:'publisherSchema', of: 3 }]
  // roles: [{
  //   type: {
  //     type:Number,
  //     min:0,
  //     max: setting.ROLES.length
  //   },

  //   kind: String,
  //   of: {type: Number, refPath: 'roles.kind'}
  // }],

  status: {
    type: Number,
    required:[true, 'User status is required.'],
    enum: [setting.USER_STATUS.INACTIVE, setting.USER_STATUS.ACTIVE],
    default: setting.USER_STATUS.ACTIVE
  },

  lastActive: Date,

  //isSuperAdmin: Boolean,

  // new
  city: String,
  channels: {
    fb: String,
    twt: String,
    ig: String,
    yt: String
  },
  signupOn: {
    type:Number,
    ref:'Publisher',
    //required: [true, 'User must signup on some publisher.']
  },
  memberOfs: {
    type: [Number], // this will be publisher id number
    required:[true, 'memberOfs is required.']
  },
  // TODO
  // this will be auto-gen when 1st register, and when user role changed.
  intro: String,   // e.g. Editor of XXX and writer of YYY
  //roles: [ roleSchema ]
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
})
/*// return user url
userSchema.virtual('url').get(function(){
  return config.HOST.BACKURL + '/u/' + this.username
})*/
/*userSchema.methods.getUrl = function(cb){

}*/

// return pic 'path', not just filename or full url
// userSchema.methods.getPic = function(size){
//   let picname;
//   // Get specify photo size, else _photo['medium'], else get the first ele
//   if(this._photo)
//     picname = this._photo[size] || this._photo.medium || this._photo[Object.keys(this._photo)[0]]

//   if(picname)
//     return helpers.getUserFolderUrl(this) + '/' + picname;
//   else if(this.facebook && this.facebook.id)
//     return this.getFBPicUrl(size);
//   else
//     return config.PHOTO.DEFAULT_USER_PIC;
// }

// Get user photo, format : {medium: '', small: ''}
// Create url

userSchema.virtual('pic').get(function(){
  let result = {}

  if(this._photo) {
    for(let key in this._photo)
      result[key] = helpers.getUserFolderUrl(this) + '/' + this._photo[key]
  } else if(this.facebook && this.facebook.id) {
    for(let key in config.PHOTO.USER_PHOTO){
      result[key] = this.facebook.pic + '?'
      if(config.PHOTO.USER_PHOTO[key].width)
        result[key] += 'width='+config.PHOTO.USER_PHOTO[key].width+'&'
      if(config.PHOTO.USER_PHOTO[key].height)
        result[key] += 'height='+config.PHOTO.USER_PHOTO[key].height+'&'
    }
  }
  else result['medium'] = config.PHOTO.DEFAULT_USER_PIC['medium']

  return result
})
// default is medium size photo
// userSchema.virtual('pic').get(function(){
//   return this.getPic('medium')
// })

// userSchema.methods.getFBPicUrl = function(size){
//   let w = config.PHOTO.USER_PHOTO[size].width || config.PHOTO.USER_PHOTO[size].height || null
//   if(w) return this.facebook.pic + '?width='+w+'&height='+w   //small
//   else return this.facebook.pic
// }

// userSchema.virtual('pic').get(function(){
// 	if(this._photo)
//     return helpers.getUserFolderUrl(this) + '/' + this._photo;
// 	else if (this.facebook && this.facebook.id)
//     return this.facebook.pic
// 	else
//     return config.PHOTO.DEFAULT_USER_PIC;
// })

userSchema.virtual('facebook.pic').get(function(){
	if(this.facebook && this.facebook.id) {
    return 'http://graph.facebook.com/'+this.facebook.id+'/picture'
  } else {
    return null;
  }
})

userSchema.plugin(autoInc.plugin, 'User')
userSchema.plugin(plugins.updateCreate)
userSchema.plugin(uniqueValidator, { message: 'This email has already been signed up.' })

userSchema.statics.getDetailJSON = function(query, fields, cb = () => {}){
  return this
  .findOne(query, fields)
  .then(u => {
    if(!u) throw new NotFoundError()

    //u.url = helpers.getUserUrl(u)

    u = helpers.stashAndUrlUser( u.toJSON() )
    //strip off sensitive info
    //delete u.password

    cb(null, u)
    return u
  })
  .catch(e => { cb(e) })
}

userSchema.methods.getUrl = function(cb){
  try{
    let url = helpers.getUserUrl(this)
    this.url = url
    //console.log('url', url)
    cb(null, url)
  } catch(e) {
    cb(e)
  }
}

userSchema.pre('save', function(next){
  // default lastActive to be created
  if(!this.lastActive && this.isNew)
    this.lastActive = this.created

  //console.log('firstname', this.firstname)
  // if(this.isDirectModified('firstname')){
  //   this.firstname = _.capitalize(this.firstname)
  // }

  // if(this.isDirectModified('lastname')){
  //   this.lastname = _.capitalize(this.lastname)
  // }

  if(!this.display){
    // if(this.firstname && this.lastname) {
    //   // this should be edit for the foreign name in the future.
    //   this.display = this.firstname + (this.lastname ? ' '+this.lastname.substring(0,2)+'.' : '')
    // } else {
    //   this.display = this.username
    // }
    this.display = this.username
  }

  // last thing to check is pwd
  // hash the pwd, must be new doc cause we don't allow to change pwd directly (must use changePassword method).
  if(this.isDirectModified('password') && this.isNew){
    //this.password = bcrypt.hashSync(this.password, 10)
    //if(this.isNew) this.setPassword(this.password)
    //else throw new Error('Use changePassword to modify existing password.')
    this.setPassword(this.password).then(next).catch(next)
  }
  else next()
})

// this method doesn't save the entity, it just validate, .save should be called later.
userSchema.methods.setPassword = function(pwd){
  let self = this

  return new Promise((resolve, reject) => {
    // Validate first
    if(!pwd || pwd.length < 6) return reject(new Errors({password:Valid.SixLengthPwd}))

    bcrypt.hash(pwd, 10, (e, hash) =>{
      if(e) return reject(new Errors({password: e}))

      self.password = hash
      resolve(self)
    })
  })
}
// this method doesn't save the entity, it just validate, .save should be called later.
userSchema.methods.changePassword = function(oldPwd, newPwd){
  let self = this

  return new Promise((resolve, reject) => {
    bcrypt.compare(oldPwd, self.password, (e, matched) => {
      if(e) reject(new Errors({password: e}))
      else if(matched) resolve(self.setPassword(newPwd))
      else reject(new Errors({password:Valid.IncorrectOldPwd}))
    })
  })
}

let User = mongoose.model('User', userSchema);

/*
  New role object (not implement now yet) :
  {
    type: [WRTIER, EDITOR, ADMIN],
    user: id,
    kind: 'Publisher', 'Column',
    item: id of kind
  }

  Role on user object :
  {
    memberOf: [pid]
  }

  Role on publisher obj :
  {
    admins: [uid]
  }

  Role on column obj :
  {
    editors: [uid],
    writers: [uid]
  }
*/

let roleSchema = new Schema({
  //_id: Number,
  type: {
    type:Number,
    min:0,
    max: ROLES.length,
    required: [true, 'Role type must be specified.']
  },

  user: {
    type:Number,
    ref:'User',
    required: [true, 'A role must related to user.'],

  },

  //optional
  column: {
    type:Number,
    ref:'Column'
  },

  publisher: {
    type:Number,
    ref:'Publisher',
    required: [true, 'A role must related to publisher.']
  }
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
})
//roleSchema.plugin(autoInc.plugin, 'Role')
roleSchema.plugin(plugins.updateCreate)
roleSchema.plugin(uniqueValidator)
roleSchema.index({user:1, publisher:1, column:1, type:1}, {unique: true, sparse: true})

function generateUserIntro(uid, pid){
  Role.find({user: uid, publisher:pid, column:{$ne:null} })
  .populate({
    path: 'column',
    select: 'name'
  })
  .then(rs => {
    let result = ''

    if(rs.length > 0){

      let edts = _.filter(rs, {type:ROLES.EDITOR})
      //console.log('edts', edts.length)
      if(edts.length > 0){
        result += 'Editor of '
        for(let i=0; i<edts.length && result.length < setting.INTRO_MAX_LENGTH-10; i++) {
          result += (i===0 ? '' : (i+1===edts.length ? ' and ' : ', ')) + edts[i].column.name
        }
        result += '. '
      }

      let wrts = _.filter(rs, {type:ROLES.WRITER})
      //console.log('wrts', wrts.length)
      if(wrts.length > 0){
        result += 'Writer of '
        for(let i=0; i<wrts.length && result.length < setting.INTRO_MAX_LENGTH-10; i++) {
          result += (i===0 ? '' : (i+1===wrts.length ? ' and ' : ', ')) + wrts[i].column.name
        }
        result += '.'
      }

    }
    //console.log('update', result)
    User.update({_id:uid}, {intro: result}).exec()
  })
}

// param column is optional
// this method doesn't authorize user or force client to update cookie
// (Untested)
roleSchema.statics.newRole = Promise.promisify( function(uid, type, pid, cid, cb){
  if(uid==null || type==null || pid==null) throw new Error('User, type, and publisher must be specified.')

  let role = new Role({
    user: uid,
    type: type,
    publisher: pid
  })
  if(cid!=null) role.column = cid

  // To add writer/editor, must have column id
  if((role.type === ROLES.WRITER || role.type === ROLES.EDITOR) && role.column==null)
    return cb( new Error("To add writer/editor, require column id.") )

  role.save()
  .then(r => {
    if(type === ROLES.ADMIN) {
      //console.log('TO ADD ADMIN', uid, type, pid, cid)
      Publisher.findByIdAndUpdate(
        pid,
        {$addToSet: {admins: uid}},
        {upsert:false, new:true}
      )
      .populate({
        path: 'admins',
        select: Populate.PublisherAdmin
      })
      .then(p => {
        if(!p.admins) p.admins = []
        p.admins.forEach( a => {
          a.url = helpers.getUserUrl(a)
        })

        cb(null, {role:r, admins:p.admins})
      })
      .catch(cb)

    } else if(type === ROLES.WRITER){

      Column.findOneAndUpdate(
        {_id: cid, publisher: pid},
        {$addToSet: {writers: uid}},
        {upsert:false, new:true}
      )
      .populate({
        path: 'writers',
        select: Populate.ColumnWriters
      })
      .then(c => {
        //console.log('CCCC', cid, pid, c)
        if(!c.writers) c.writers = []
        c.writers.forEach( w => {
          w.url = helpers.getUserUrl(w)
        })

        cb(null, {role:r, writers:c.writers})
      })
      .catch(cb)

      generateUserIntro(uid, pid)

    } else if(type === ROLES.EDITOR){

      Column.findOneAndUpdate(
        {_id: cid, publisher: pid},
        {$addToSet: {editors: uid}},
        {upsert:false, new:true}
      )
      .populate({
        path: 'editors',
        select: Populate.ColumnWriters
      })
      .then(c => {
        if(!c.editors) c.editors = []
        c.editors.forEach( e => {
          e.url = helpers.getUserUrl(e)
        })

        cb(null, {role:r, editors:c.editors})
      })
      .catch(cb)

      generateUserIntro(uid, pid)

    //} else cb(null, r)
    // Just return newly created role
    } else cb(null, {role: r})
  })
  .catch(cb)

} )


roleSchema.statics.removeRole = Promise.promisify( function(uid, type, pid, cid, cb){
  if(!uid || type==null || !pid) throw new Error('User, type, and publisher must be specified.')

  let query = {user:uid, type:type, publisher:pid}
  if(cid!=null) query.column = cid

  // To remove writer/editor, must have column id
  if((query.type === ROLES.WRITER || query.type === ROLES.EDITOR) && query.column==null)
    return cb( new Error("To remove writer/editor, require column id.") )

  Role.findOneAndRemove(query)
  .then(r => {
    //console.log('role to remove', query, r)
    if(!r){
      cb(new NotFoundError('Cannot find role'))
      return
    }

    //cb(null, {role:r})

    if(type === ROLES.ADMIN) {

      Publisher.findByIdAndUpdate(
        pid,
        {$pull: {admins: uid}},
        {upsert:false, new:true}
      )
      .populate({
        path: 'admins',
        select: Populate.PublisherAdmin
      })
      .then(p => {
        p.admins.forEach( a => {
          a.url = helpers.getUserUrl(a)
        })

        // Return role object and remaining admins
        cb(null, {role:r, admins: p.admins})
      })
      .catch(cb)

    } else if(type === ROLES.WRITER){

      Column.findOneAndUpdate(
        {_id: cid, publisher: pid},
        {$pull: {writers: uid}},
        {upsert:false, new:true}
      )
      .populate({
        path: 'writers',
        select: Populate.ColumnWriters
      })
      .then(c => {
        c.writers.forEach( w => {
          w.url = helpers.getUserUrl(w)
        })

        cb(null, {role:r, writers: c.writers})
      })
      .catch(cb)

      generateUserIntro(uid, pid)

    } else if(type === ROLES.EDITOR){

      Column.findOneAndUpdate(
        {_id: cid, publisher: pid},
        {$pull: {editors: uid}},
        {upsert:false, new:true}
      )
      .populate({
        path: 'editors',
        select: Populate.ColumnWriters
      })
      .then(c => {
        c.editors.forEach( e => {
          e.url = helpers.getUserUrl(e)
        })

        cb(null, {role:r, editors: c.editors})
      })
      .catch(cb)

      generateUserIntro(uid, pid)

    } else cb(null, {role:r})

  }).catch(cb)
} )

let Role = mongoose.model('Role', roleSchema);


let hashSchema = new Schema({
  value: {
    type: String,
    required: true
  },

  created: {
    type: Date,
    default: new Date()
  },

  publisher: {
    type:Number,
    ref:'Publisher',
    required: [true, 'Hash must belong to a publisher.']
  },

  story: { //optional
    type:Number,
    ref:'Story'
  }
})
let Hash = mongoose.model('Hash', hashSchema);


let contactSchema = new Schema({
  email:{
    type:String,
    trim:true,
    required: [true, 'Email is required.'],
    validate: {
      validator: function(v){
        return validator.isEmail(v)
      },
      message: '{VALUE} is not a valid email.'
    }
  },
  name: {
    type:String,
    trim:true,
    required: [true, 'Name is required.']
  },
  detail: {
    type:String,
    trim:true,
    required: [true, 'Detail is required.']
  },
  tel: {
    type:String,
    trim:true
  },
  publisher: {
    type:Number,
    ref:'Publisher',
    required: [true, 'An contact must belong to the publisher.']
  }
})
contactSchema.plugin(plugins.updateCreate)
let Contact = mongoose.model('Contact', contactSchema);


let commentSchema = new Schema({
  _id: Number,
  status: {
    type: Number,
    required:[true, 'Story status is required.'],
    enum: [setting.COMMENT_STATUS.HIDE, setting.COMMENT_STATUS.SHOW],
    default: setting.COMMENT_STATUS.SHOW
  },
  on: {
    kind: String, // story, comment, paragraph (future)
    item: {type: Number, refPath: 'on.kind', required:[true, 'A comment must have relation "on"']}
  },
  // for subcomment (reply)
  by: {
    type:Number,
    ref:'User',
    required: [true, 'A comment must have a writer.']
  },
  text: { //only text allow, no markdown or html
    type:String,
    required:[true, 'A comment cannot be empty'],
    trim:true,
    validator: {
      validator: function(v){
        return v.length <= setting.COMMENT_MAX_LENGTH
      },
      message: 'The comment is too long, keep it simple!'
    }
  },
  votes: {
    total: { type:Number, default:0, min:[0, Valid.CannotBeNegative] },
    up: { type: Number, default: 0, min:[0, Valid.CannotBeNegative] },
    down: { type: Number, default: 0, min:[0 ,Valid.CannotBeNegative] }
  },

  parent: {
    type:Number,
    ref:'Comment'
  },
  replies: {
    count: { type: Number, default: 0, min:[0, Valid.CannotBeNegative] },
    items: [ { type: Number, ref: 'Comment' } ]
  }
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
})
commentSchema.plugin(autoInc.plugin, 'Comment')
commentSchema.plugin(plugins.updateCreate)

// Get story comments and their replies as well
commentSchema.statics.getComments = function(id, kind, commentOpt = {}, replyOpt = {}){
  commentOpt.page = commentOpt.page || 0
  commentOpt.limit = commentOpt.limit || setting.COMMENT.LIMIT

  replyOpt.page = replyOpt.page || 0
  replyOpt.limit = replyOpt.limit || setting.REPLY.LIMIT

  return new Promise((resolve, reject) => {
    if(id==null) return reject(new Error('id is required.'))

    Comment.find(
      {
        'on.kind':kind,
        'on.item': id,
        parent:null, // comment is not a reply, comment has parent = null
        status: {$ne:setting.COMMENT_STATUS.HIDE}
      },
      {},
      {skip: commentOpt.page*commentOpt.limit, limit:commentOpt.limit}
    )
    .populate([
      {
        path: 'replies.items',
        match:{
          status:{ $ne:setting.COMMENT_STATUS.HIDE }
        },
        options: {
          limit: replyOpt.limit,
          skip: replyOpt.page*replyOpt.limit
        },

        populate: { path:'by', select:Populate.StoryWriter }
      },
      { path:'by', select:Populate.StoryWriter }
    ])
    .sort([['created', -1]])
    .then(comments => {
      resolve(comments)
    })
    .catch(reject)

  })

}

commentSchema.methods.getReplies = function(replyOpt = {}){
  let self = this
  replyOpt.page = replyOpt.page || 0
  replyOpt.limit = replyOpt.limit || setting.REPLY.LIMIT

  return new Promise((resolve, reject) => {
    mongoose.model('Comment').find(
      {'parent': self._id},
      {},
      {skip: replyOpt.page*replyOpt.limit, limit:replyOpt.limit}
    )
    .populate({
      path:'by',
      select:Populate.StoryWriter,
      match:{
        status:{ $ne:setting.COMMENT_STATUS.HIDE }
      }
    })
    .sort([['created', -1]])
    .then(replies => {
      resolve(replies)
    })
    .catch(reject)
  })
}
// commentSchema.statics.getReplies = function(comid, replyOpt = {}){
//   replyOpt.page = replyOpt.page || 0
//   replyOpt.limit = replyOpt.limit || setting.REPLY.LIMIT

//   return new Promise((resolve, reject) => {
//     if(comid==null) return reject(new Error('Comment id is required.'))

//     Comment.find(
//       {'parent': comid},
//       {},
//       {skip: replyOpt.page*replyOpt.limit, limit:replyOpt.limit}
//     )
//     .populate({
//       path:'by',
//       select:Populate.StoryWriter,
//       match:{
//         status:{ $ne:setting.COMMENT_STATUS.HIDE }
//       }
//     })
//     .sort([['created', -1]])
//     .then(replies => {
//       resolve(replies)
//     })
//     .catch(reject)
//   })
// }

// Return created comment
commentSchema.statics.createComment = function(comment, kind, kindId){
  let self = this

  return new Promise((resolve, reject) => {
    if(kindId==null) return reject(new Error('kindId is required.'))

    if(comment) comment.on = {kind:kind, item:kindId}
    //console.log('createStoryComment0', sid, comment)

    // 1. Save a comment
    self.create(comment, (e, com) => {
      if(e) return reject(e)
      if(!com) return reject(new Error('Cannot create the comment.'))

      // 2. Add into story.comments
      mongoose.model(kind).update(
        {_id: kindId},
        {$push: {'comments.items': {$each: [com._id], $position: 0}}, $inc:{'comments.count': 1}},
        {upsert:false},
        (e, status) => {
          //console.log('createStoryComment1',e, status)
          if(e || !status.ok) return reject(new Error('Unable to add a comment.'))

          resolve(com)
        }
      )
    })
  })
}

// Return removed comment
commentSchema.statics.removeComment = function(comid, kind, kindId){
  let self = this

  return new Promise((resolve, reject) => {
    if(kindId==null || comid==null) return reject(new Error('kindId and comid are required.'))

    // 1. Remove a comment
    self.findByIdAndRemove(comid, (e, com) => {
      if(e) return reject(e)
      if(!com) return reject(new NotFoundError('Cannot found the comment.'))

      // 2. Pull from story.comments
      mongoose.model(kind).update(
        {_id: kindId},
        {$pull: {'comments.items': com._id}, $inc:{'comments.count': -1}},
        {upsert:false},
        (e, status) => {
          if(e || !status.ok) return reject(new Error('Unable to pull a comment.'))

          // 3. Remove all replies of the comment (dependencies)
          //self.remove({'on.kind':kind, 'on.item':comid}, e => {
          self.remove({parent: comid}, e => {
            if(e) return reject(e)

            resolve(com)
          })
        }
      )
    })
  })
}

// Return created reply
commentSchema.methods.createReply = function(reply){
  let self = this

  return new Promise((resolve, reject) => {
    if(!reply) return reject(new Error('reply is required.'))

    //if(reply) reply.on = {kind:'Comment', item:comid}
    reply.parent = self._id
    reply.on = self.on  // derive comment.on to its reply.

    // 1. Save a reply, reply has a type as "Comment".
    mongoose.model('Comment').create(reply, (e, rep) => {
      if(e) return reject(e)
      if(!rep) return reject(new Error('Cannot create the reply.'))

      // 2. Add into comment.replies
      mongoose.model('Comment').update(
        {_id: self._id},
        {$push: {'replies.items': {$each: [rep._id], $position: 0}}, $inc:{'replies.count': 1}},
        {upsert:false},
        (e, status) => {
          if(e || !status.ok) return reject(new Error('Unable to add a comment\'s reply.'))

          resolve(rep)
        }
      )
    })
  })
}
// Return created reply
// commentSchema.statics.createReply = function(comid, reply){
//   let self = this

//   return new Promise((resolve, reject) => {
//     if(comid==null || !reply) return reject(new Error('comid and reply are required.'))

//     //if(reply) reply.on = {kind:'Comment', item:comid}
//     reply.parent = comid

//     // 1. Save a reply
//     self.create(reply, (e, rep) => {
//       if(e) return reject(e)
//       if(!rep) return reject(new Error('Cannot create the reply.'))

//       // 2. Add into comment.replies
//       self.update(
//         {_id: comid},
//         {$push: {'replies.items': {$each: [rep._id], $position: 0}}, $inc:{'replies.count': 1}},
//         {upsert:false},
//         (e, status) => {
//           if(e || !status.ok) return reject(new Error('Unable to add a comment\'s reply.'))

//           resolve(rep)
//         }
//       )
//     })
//   })
// }

commentSchema.methods.removeReply = function(replyid){
  let self = this

  return new Promise((resolve, reject) => {
    if(replyid==null) return reject(new Error('replyid is required.'))

    // 1. Remove a reply
    mongoose.model('Comment').findByIdAndRemove(replyid, (e, rep) => {
      if(e) return reject(e)
      if(!rep) return reject(new NotFoundError('Cannot found the reply.'))

      // 2. Pull from comment.replies
      mongoose.model('Comment').update(
        {_id: self._id},
        {$pull: {'replies.items': rep._id}, $inc:{'replies.count': -1}},
        {upsert:false},
        (e, status) => {
          if(e || !status.ok) return reject(new Error('Unable to remove a comment\'s reply.'))

          resolve(rep)
        }
      )
    })
  })
}
// Return removed reply
// commentSchema.statics.removeReply = function(comid, replyid){
//   let self = this

//   return new Promise((resolve, reject) => {
//     if(comid==null || replyid==null) return reject(new Error('comid and replyid are required.'))

//     // 1. Remove a reply
//     self.findByIdAndRemove(replyid, (e, rep) => {
//       if(e) return reject(e)
//       if(!rep) return reject(new Error('Cannot remove the reply.'))

//       // 2. Pull from comment.replies
//       self.update(
//         {_id: comid},
//         {$pull: {'replies.items': rep._id}, $inc:{'replies.count': -1}},
//         {upsert:false},
//         (e, status) => {
//           if(e || !status.ok) return reject(new Error('Unable to remove a comment\'s reply.'))

//           resolve(rep)
//         }
//       )
//     })
//   })
// }

commentSchema.pre('save', function(next){
  if(this.isModified('votes')){
    this.votes.total = this.votes.up - this.votes.down
  }
  next()
})


let Comment = mongoose.model('Comment', commentSchema);


let storySchema = new Schema({
  _id: Number,
  status: {
    type: Number,
    required:[true, 'Story status is required.'],
    enum: [setting.STORY_STATUS.DRAFT, setting.STORY_STATUS.SHOW, setting.STORY_STATUS.SCHEDULE],
    default: setting.STORY_STATUS.DRAFT
  },
  // drafted title
  title: {
    type:String,
    //required:[true, 'Story title is required.'],
    trim:true,
    maxlength: setting.TITLE_MAX_LENGTH
  },
  // published title
  ptitle: {
    type:String,
    trim:true,
    maxlength: setting.TITLE_MAX_LENGTH
  },
  readTime: Number, //min to read, compute everytime a story updated

  // used when searching
  // in the future, should be more sophisticate, might use keywords
  // with important paragraph to derive better search result.
  contentShort: {
    type: String,
    trim: true,
    maxlength: setting.SHORTDESC_LENGTH
  },
  content : {
    type: String,
    trim: true
  },
  html : String, // drafted html
  phtml : String,  // published html

  _cover: Schema.Types.Mixed,
  _coverMobile: Schema.Types.Mixed,

  // used when casting this doc
  url: String,

  writer: {
    type:Number,
    ref:'User',
    required: [true, 'A story must have a writer.']
  },
  column: {
    type:Number,
    ref:'Column',
    //required: [true, 'An story must have column.']
  },
  // use this publsiher to check slug uniqueness
  publisher: {
    type:Number,
    ref:'Publisher',
    required: [true, 'An story must belong to the publisher.']
  },

  // increment everytime story viewed
  views: {
    type: Number,
    default: 0
  },

  tags: [
    { type: Number, ref: 'Tag' }
  ],

  // NEW
  contentType: {
    type: String,
    required:[true, 'Content type is required.'],
    enum: setting.CONTENT_TYPES,
    default: 'NEWS',
    uppercase: true
  },
  format: {
    type: String,
    required:[true, 'Story format is required.'],
    enum: setting.STORY_FORMATS,
    default: 'NEWS',
    uppercase: true
  },
  shares: {
    // shared by link, captured by hash after the story's url,
    // every share except fb, twt, line will be counted in this field.
    total: { type:Number, default:0, min:[0, Valid.CannotBeNegative] },
    link: { type: Number, default: 0, min:[0, Valid.CannotBeNegative] },
    fb: { type: Number, default: 0, min:[0, Valid.CannotBeNegative] },
    twt: { type: Number, default: 0, min:[0, Valid.CannotBeNegative] },
    line: { type: Number, default: 0, min:[0, Valid.CannotBeNegative] }
  },
  comments: {
    count: { type: Number, default: 0, min:[0, Valid.CannotBeNegative] },
    items: [{ type:Number, ref:'Comment' }]
  },
  votes: {
    total: { type:Number, default:0, min:[0, Valid.CannotBeNegative] },
    up: { type: Number, default: 0, min:[0, Valid.CannotBeNegative] },
    down: { type: Number, default: 0, min:[0 ,Valid.CannotBeNegative] }
  },
  published: Date
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
})

// NEW
// storySchema.virtual('shares.total').get(function(){
//   if(!this.shares) return 0

//   return (this.shares.link || 0) +
//     (this.shares.fb || 0) +
//     (this.shares.twt || 0) +
//     (this.shares.line || 0)
// })
// storySchema.virtual('votes.total').get(function(){
//   if(!this.votes) return 0

//   return (this.votes.up || 0) -
//     (this.votes.down || 0)
// })
storySchema.virtual('cover').get(function(){
  let result = {}

  if(this._cover) {
    for(let key in this._cover)
      result[key] = helpers.getStoryFolderUrl(this) + '/' + this._cover[key]
  }
  else result['medium'] = config.PHOTO.DEFAULT_STORY_PIC

  return result
})
storySchema.virtual('coverMobile').get(function(){
  let result = {}

  if(this._coverMobile) {
    for(let key in this._coverMobile)
      result[key] = helpers.getStoryFolderUrl(this) + '/' + this._coverMobile[key]
  }
  else result['medium'] = config.PHOTO.DEFAULT_STORY_MOBILE_PIC

  return result
})
// // return pic url
// articleSchema.virtual('coverPic').get(function(){
//   return (this._cover) ? helpers.getArticleFolderUrl(this) + '/' + this._cover : config.PHOTO.DEFAULT_ARTICLE_PIC
// })
// // return pic url
// articleSchema.virtual('coverMobilePic').get(function(){
//   return (this._coverMobile) ? helpers.getArticleFolderUrl(this) + '/' + this._coverMobile : config.PHOTO.DEFAULT_ARTICLE_MOBILE_PIC
// })

storySchema.plugin(autoInc.plugin, 'Story')
storySchema.plugin(plugins.updateCreate)
storySchema.plugin(uniqueValidator)
storySchema.plugin(plugins.slug, {uniqueCheck:false})

// Count total published stories available
storySchema.statics.countAll = function(cb){
  return this.count({status:1}).exec(cb)
}

// countView is flag decided whether to count "views" or not.
// sometimes views shouldn't be counted.
storySchema.statics.getDetail = function(prop, countView = false, cb = () => {}){
  let promise
  if(countView) promise = this.findOneAndUpdate(prop, {$inc:{views:1}}, {new:false})
  else promise =  this.findOne(prop)

  //console.log('prop', prop)
  return promise
    //.findById(id)
    .populate({
      path: 'publisher',
      select: Populate.StoryPublisher
    })
    .populate({
      path: 'column',
      select: Populate.StoryColumn
    })
    .populate({
      path: 'writer',
      select: Populate.StoryWriter
    })
    .then(_a => {
      //console.log('_a', _a)
      if(!_a) throw new NotFoundError()

      if(countView) {
        _a.views++

        // add 'view' StoryInsight
        StoryInsight.inc(_a._id, INACT.VIEW, null, _a.contentType)
      }
      _a.url = helpers.getStoryUrl(_a, _a.column, _a.writer)//helpers.getStoryUrl(_a.publisher, _a.column, _a)
      if(_a.column) _a.column.url = helpers.getColumnUrl(_a.column)
      if(_a.writer) _a.writer.url = helpers.getUserUrl(_a.writer)
      //_a.publisher.url = helpers.getPublisherUrl(_a.publisher)
      cb(null, _a)
      return _a
    })
    .catch(e => {
      cb(e)
    })
}

storySchema.methods.getUrl = function(cb){
  this.populate({
    path: 'publisher',
    select: 'slug'
  })
  .populate({
    path: 'column',
    select: 'slug'
  }, (function(e, a){
    try{
      if(!e && a) {
        this.url = helpers.getStoryUrl(a, a.column, a.writer)//helpers.getStoryUrl(a.publisher, a.column, a)
      }
      //console.log('url', this.url)
      cb(e, this.url)
    } catch(e) {
      cb(e)
    }
  }).bind(this) )
}

storySchema.pre('save', function (next) {
  let self = this
  // Calculate content and readTime
  // read time calculated from content length
  // contentShort substringed from content as well
  // if(this.isDirectModified('phtml')){
  //   this.content = htmlToText.fromString(this.phtml)
  //   this.contentShort = _.truncate(this.content, {
  //     'length': setting.SHORTDESC_LENGTH,
  //     'separator': /,? +/
  //   })
  //   let readTime = Math.round(_.words(this.content).length / 200)
  //   this.readTime = (readTime===0) ? 1 : readTime
  // }

  //console.log('STATUS', this.status, this.title, this.isDirectModified('status'))
  if(this.isDirectModified('status') && this.status === setting.STORY_STATUS.SHOW) {
    if(!this.title){
      // not meet the prerequisite of publishing story
      // revert status value back and return err
      this.status = setting.STORY_STATUS.DRAFT
      return next(new Error('Story must have title before publishing.'))
    } else {
      this.published = new Date
      this.ptitle = this.title
      this.phtml = this.html

      // Calculate content and readTime
      // read time calculated from content length
      // contentShort substringed from content as well
      this.content = htmlToText.fromString(this.phtml)
      this.contentShort = _.truncate(this.content, {
        'length': setting.SHORTDESC_LENGTH,
        'separator': /,? +/
      })
      let readTime = Math.round(_.words(this.content).length / 200)
      this.readTime = (readTime===0) ? 1 : readTime
    }
  }

  if(this.isModified('shares')){
    //console.log('MODIFY SHARES')
    this.shares.total = this.shares.link + this.shares.fb + this.shares.twt + this.shares.line
  }

  if(this.isModified('votes')){
    this.votes.total = this.votes.up - this.votes.down
  }

  next()

  // this.wasNew = this.isNew

  //  // If story is "published", column, title, and publisher must be presented.
  // // else set story to unpublished, stop saving operation, and send back error
  // if((this.publisher==null || this.column==null || !this.title) && this.status === setting.STORY_STATUS.SHOW){

  //   this.status = setting.STORY_STATUS.DRAFT

  //   next(new Error('Require to assign story\'s publisher, column, and title before publishing.'))
  // }
  // else next()
})

// function removeFromRecentArticles(article, cb){
//    let cid = parseInt( (article.column && article.column._id) ? article.column._id : article.column )

//   // remove this article from column's "recentArticles"
//   Column.findById(cid, function(e, _c){
//     if(e || !_c) return
//     //console.log('to pull0', cid)
//     //console.log('to pull1', cid, _c.recentArticles, article._id)
//     _.pull(_c.recentArticles, article._id)
//     //_c.recentArticles.id(_a._id)
//     //console.log(_a._id+' pulled')
//     //console.log('removeFromRecentArticles0', e, _c)
//     Column.update(_c._id, {$set: {recentArticles:_c.recentArticles}}, function(e, s){
//       //console.log('removeFromRecentArticles1', e, s)
//       if(cb) cb(e)
//     })
//   })
// }

let Story = mongoose.model('Story', storySchema);

/*
TODO
*/
let columnSchema = new Schema({
  _id: Number,
  status: {
    type: Number,
    required:[true, 'Column status is required.'],
    enum: [setting.COLUMN_STATUS.HIDE, setting.COLUMN_STATUS.SHOW],
    default: setting.COLUMN_STATUS.SHOW
  },
  name: {
    type:String,
    required:[true, 'Column name is required.'],
    trim:true,
    maxlength: setting.TITLE_MAX_LENGTH
  },
  // text, not markdown
  shortDesc: {
    type:String,
    trim:true,
    maxlength: setting.SHORTDESC_LENGTH
  },

  // used when casting this doc
  url: String,

  // //filename
  // _cover: {
  //   type: String,
  //   trim: true
  // },
  // //filename
  // _profile: {
  //   type: String,
  //   trim: true
  // },
  _cover: Schema.Types.Mixed,

  publisher: {
    type:Number,
    ref:'Publisher',
    required: [true, 'A column must have publisher.']
  },

  writers: [
    { type: Number, ref: 'User' }
  ],

  editors: [
    { type: Number, ref: 'User' }
  ]

  // recentArticles: [
  //   { type: Number, ref: 'Article', required:[true, 'recentArticles is required.'] }
  // ]
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
})

/*// return column url
columnSchema.virtual('url').get(function(){
  return config.HOST.BACKURL + '/' + this.publisher + '/' + this.slug
})
*/
// // return cover pic url
// columnSchema.virtual('coverPic').get(function(){
//   return (this._cover) ? helpers.getColumnFolderUrl(this) + '/' + this._cover : config.PHOTO.DEFAULT_COLUMN_COVER
// })
// // return profile pic url
// columnSchema.virtual('profilePic').get(function(){
//   return (this._profile) ? helpers.getColumnFolderUrl(this) + '/' + this._profile : config.PHOTO.DEFAULT_COLUMN_PROFILE
// })

columnSchema.plugin(plugins.updateCreate)
columnSchema.plugin(autoInc.plugin, 'Column')
columnSchema.plugin(plugins.slug, {input:'name', uniqueFor:['publisher']})

/*// Validation for admins array
columnSchema.path('admins').validate(admins => {
  if(!admins) return false
  else if(admins.length === 0) return false
  return true
}, 'Column must have at least one admins.')*/

columnSchema.methods.getUrl = function(cb){
  // let getColUrl = (function(col){
  //   //console.log('COL', col)
  //   return helpers.getColumnUrl(col)
  // }).bind(this)

  try{
    if(this.publisher && this.publisher.slug) {

      this.url = helpers.getColumnUrl(this)
      cb(null, this.url)

    } else {

      this.populate({
        path: 'publisher',
        select: 'slug'
      }, (function(e, c){

        if(!e && c) this.url = helpers.getColumnUrl(c)
        cb(e, this.url)

      }).bind(this) )
    }

  } catch(e) {
    cb(e)
  }

  // this.populate({
  //   path: 'publisher',
  //   select: 'slug'
  // }, (function(e, c){
  //   try{
  //     if(!e && c) {
  //       this.url = helpers.getColumnUrl(c.publisher, this)
  //     }
  //     //console.log('url', this.url)
  //     cb(e, this.url)
  //   } catch(e) {
  //     cb(e)
  //   }
  // }).bind(this) )
}

columnSchema.virtual('cover').get(function(){
  let result = {}

  if(this._cover) {
    for(let key in this._cover)
      result[key] = helpers.getColumnFolderUrl(this) + '/' + this._cover[key]
  }
  else result['medium'] = config.PHOTO.DEFAULT_COLUMN_COVER

  return result
})

// columnSchema.pre('save', function(next){

//   // ensure the recentArticles not exceed 10 when added
//   if(this.isDirectModified('recentArticles') && this.recentArticles && this.recentArticles.length >= 10){
//     this.recentArticles.pop()
//     //console.log('column presave run + recentArticles modified', this.recentArticles)
//   }

//   next()
// })

/*columnSchema.methods.getUrl = function(cb){
  let self = this
  //console.log(this)

  this.model('Publisher')
  .findById(this.publisher, {slug:1})
  .exec(function(e, _p){
    cb(e, config.HOST.BACKURL+'/'+_p.slug+'/'+self.slug)
  })
}*/

let Column = mongoose.model('Column', columnSchema);


let contactCatSchema = new Schema({
  _id: {
    type: ObjectId,
    required: [true, 'Object id is required.']
  },
  catName: {
    type:String,
    trim:true,
    required: [true, 'Category name is required.']
  }, // Category name
  toEmail: {
    type:String,
    trim:true,
    //required: [true, 'Email-to-sent-to is required.'],
    validate: {
      validator: function(v){
        return validator.isEmail(v)
      },
      message: '{VALUE} is not a valid email.'
    }
  },
  desc: { type:String, trim:true } //markdown
})

/*
TODO
*/
let publisherSchema = new Schema({
  _id: Number,
  status: {
    type: Number,
    required:[true, 'Publisher status is required.'],
    enum: [setting.PUBLISHER_STATUS.HIDE, setting.PUBLISHER_STATUS.SHOW],
    default: setting.PUBLISHER_STATUS.SHOW
  },
  name: {
    type:String,
    required:[true, 'Publisher name is required.'],
    trim:true,
    maxlength: setting.TITLE_MAX_LENGTH
  },

  // text, not markdown
  desc: {
    type:String,
    trim:true,
    maxlength: setting.DESC_LENGTH
  },

  // markdown enabled
  // contactUs: {
  //   type:String,
  //   trim:true
  // },

  // markdown enabled
  aboutUs: {
    type:String,
    trim:true
  },

  // url: {
  //   type: String,
  //   trim: true,
  //   required: [true, 'Publisher url must be specified.']
  // },
  // auto created when save url
  // domain: {
  //   type: String,
  //   trim: true
  // },

  //filename
  // _cover: {
  //   type: String,
  //   trim: true
  // },
  // //filename
  // _profile: {
  //   type: String,
  //   trim: true
  // },

  // used when casting this doc
  //url: String,

  // theme: {
  //   type: String,
  //   trim: true,
  //   default: '#FFFFFF',
  //   validate: {
  //     validator: function(v){
  //       return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/.test(v)
  //     },
  //     message: '{VALUE} is not a valid color.'
  //   }
  // },

  admins: [
    { type: Number, ref: 'User' }
  ],

  // New
  _cover: Schema.Types.Mixed, //{small: 'picname', medium: 'picname'}
  tagline: {
    type:String,
    trim:true,
    maxlength:setting.SHORTDESC_LENGTH
  },   // headline on cover image

  channels: {
    fb: { type:String,  trim:true }, // fb id, not link
    twt: { type:String,  trim:true },
    ig: { type:String,  trim:true },
    yt: { type:String,  trim:true }
  },
  theme: {
    primaryColor: { type:String,  trim:true, maxlength:7 },
    secondaryColor: { type:String,  trim:true, maxlength:7 },

    //NEW
    accentColor: { type:String, trim:true, maxlength:7  },
    barBgColor: { type:String, trim:true, maxlength:7 },
    barTone: { type:String, enum:['dark', 'light'], lowercase:true },

    _logo: String,   // must be svg filename
    _slogo: String,   // square logo, must be svg filename
    _favicon: String
  },
  // connect: {
  //   // production
  //   fbAppId: { type:String, trim:true },
  //   // develop
  //   fbDevAppId: { type:String, trim:true }
  // },
  // analytic: {
  //   tagManagerId: { type:String, trim:true },
  //   quantcastAcc: { type:String, trim:true },
  //   chartbeatUid: { type:String, trim:true }
  // },
  // // default metadata
  // meta: {
  //   // auto-create from tagline
  //   title: { type:String, trim:true },
  //   // comma sperated
  //   keywords: { type:String, trim:true },
  //   // auto-create from desc
  //   desc: { type:String, trim:true }
  // },
  keywords: { type:String, trim:true },

  contactCats: [ contactCatSchema ]
}, {
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
})

/*// return publisher url
publisherSchema.virtual('url').get(function(){
  return config.HOST.BACKURL + '/' + this.slug
})*/
// return cover pic url
// publisherSchema.virtual('coverPic').get(function(){
//   return (this._cover) ? helpers.getPublisherFolderUrl(this) + '/' + this._cover : config.PHOTO.DEFAULT_PUBLISHER_COVER
// })
// // return profile pic url
// publisherSchema.virtual('profilePic').get(function(){
//   return (this._profile) ? helpers.getPublisherFolderUrl(this) + '/' + this._profile : config.PHOTO.DEFAULT_PUBLISHER_PROFILE
// })

publisherSchema.virtual('cover').get(function(){
  let result = {}

  if(this._cover) {
    for(let key in this._cover)
      result[key] = helpers.getPublisherFolderUrl(this) + '/' + this._cover[key]
  }
  else result['medium'] = config.PHOTO.DEFAULT_PUBLISHER_COVER

  return result
})

publisherSchema.virtual('theme.logo').get(function(){
  if(this.theme._logo) return helpers.getPublisherFolderUrl(this) + '/' + this.theme._logo
  else return config.PHOTO.DEFAULT_PUBLISHER_PROFILE
})
publisherSchema.virtual('theme.slogo').get(function(){
  if(this.theme._slogo) return helpers.getPublisherFolderUrl(this) + '/' + this.theme._slogo
  else return config.PHOTO.DEFAULT_PUBLISHER_PROFILE
})
publisherSchema.virtual('theme.favicon').get(function(){
  if(this.theme._favicon) return helpers.getPublisherFolderUrl(this) + '/' + this.theme._favicon
  else return config.PHOTO.DEFAULT_FAVICON
})
// publisherSchema.virtual('theme.slogo').get(function(){
//   if(this.theme._slogo) return helpers.getPublisherFolderUrl(this) + '/' + this.theme._slogo
//   else return config.PHOTO.DEFAULT_PUBLISHER_PROFILE
// })

publisherSchema.plugin(plugins.updateCreate)
publisherSchema.plugin(autoInc.plugin, 'Publisher')
//publisherSchema.plugin(plugins.slug, {model: 'Publisher', input:'name', uniqueCheck:true})
//publisherSchema.plugin(plugins.slug, {autoSlug: false, model: 'Publisher', input:'name'})

// publisherSchema.methods.getUrl = function(cb){
//   try {
//     this.url = helpers.getPublisherUrl(this)
//     cb(null, this.url)
//   } catch (e) {
//     cb(e)
//    //console.log('url', this.url)
//   }
// }
// Assume caller already authenticated
// publisherSchema.methods.createTag = function(name, cb){
//   return this.model('Tag').create({
//     name: name,
//     publisher: this._id
//   }, cb)
// }

publisherSchema.pre('save', function (next) {
  // strip off any accidentially inputed html tags
  if(this.isDirectModified('shortDesc'))
    this.shortDesc = htmlToText.fromString(this.shortDesc)

  // if(this.isDirectModified('url')){
  //   // 1. Append http:// if url doesn't have, also support https
  //   if (!/^https?:\/\//i.test(this.url))
  //     this.url = 'http://' + this.url;

  //   // 2. Create domain from url
  //   // domain is without www. e.g. nextempire.co
  //   let matches = this.url.match(/^https?\:\/\/(?:www\.)?([^\/?#]+)(?:[\/?#]|$)/i);
  //   this.domain = matches && matches[1];
  // }

  // if(this.isDirectModified('desc')){
  //   this.meta.desc = this.desc
  // }
  // if(this.isDirectModified('tagline') || this.isDirectModified('name')){
  //   this.meta.title = this.name + ' | ' this.tagline
  // }
  //if(this.isDirectModified('theme')) this.theme = _.toUpper(this.theme)

  next()
})

let Publisher = mongoose.model('Publisher', publisherSchema);


let tagSchema = new Schema({
  _id: Number,
  status: {
    type: Number,
    required:[true, 'Tag status is required.'],
    enum: [setting.TAG_STATUS.HIDE, setting.TAG_STATUS.SHOW],
    default: setting.TAG_STATUS.SHOW
  },
  name: {
    type:String,
    required:[true, 'Tag name is required.'],
    trim:true,
    maxlength: setting.TITLE_MAX_LENGTH
  },
  publisher: {
    type:Number,
    ref:'Publisher',
    required:[true, 'Tag must belong to the publisher.']
  },

  // used when casting this doc
  url: String

  //views: Number // in the future => to count hit
})

tagSchema.plugin(plugins.updateCreate)
tagSchema.plugin(autoInc.plugin, 'Tag')
tagSchema.index({name:1, publisher:1}, {unique: true})
tagSchema.plugin(plugins.slug, {input:'name', uniqueFor:['publisher']})

let Tag = mongoose.model('Tag', tagSchema);


// let inviteSchema = new Schema({
//   _id: Number,
//   status: {
//     type: Number,
//     required:[true, 'Invitation status is required.'],
//     enum: [setting.INVITE_STATUS.SENT, setting.INVITE_STATUS.ACCEPTED],
//     default: setting.INVITE_STATUS.SENT
//   },
//   sender: {
//     type:Number,
//     ref:'User',
//     required:[true, 'Sender is required.']
//   },
//   to: {
//     // opt
//     type:Number,
//     ref:'User'
//   },
//   email: {
//     type:Number,
//     ref:'User',
//     required:[true, 'Email is required.']
//   },

//   action: {
//     type:Number,
//     enum: [setting.INVITE_ACTION.BE_WRITER],
//     required:[true, 'Invitation action is required.']
//   },
//   object: {
//     kind: String,
//     _id: {type: Number, refPath: 'object.kind'}
//   },

//   msg: {
//     type:String,
//     trim: true,
//     maxlength: setting.SHORTDESC_LENGTH
//   }
// })

// inviteSchema.plugin(plugins.updateCreate)
// inviteSchema.plugin(autoInc.plugin, 'Invite')

// let Invite = mongoose.model('Invite', inviteSchema);


// let SASchema = new Schema({
//    user: { type: Number, ref: 'User' }
// })
// let SuperAdmin = mongoose.model('SuperAdmin', SASchema);

//=======================

const INACT = setting.INSIGHT_ACTION

// date must be moment
function getPastSevenDays(action, subaction, currentDate, filter){
  if(!currentDate) currentDate = moment()
  return this.getRange(
    moment(currentDate).subtract(6,'days'),
    moment(currentDate).add(1,'days'),
    action,
    subaction,
    filter
  )
}
function getAWeekAgo(action, subaction, currentDate, filter){
  if(!currentDate) currentDate = moment()
  return this.getRange(
    moment(currentDate).subtract(13,'days'),
    moment(currentDate).subtract(6,'days'),
    action,
    subaction,
    filter
  )
}
function getTwoWeeksAgo(action, subaction, currentDate, filter){
  if(!currentDate) currentDate = moment()
  return this.getRange(
    moment(currentDate).subtract(20,'days'),
    moment(currentDate).subtract(13,'days'),
    action,
    subaction,
    filter
  )
}
function getThreeWeeksAgo(action, subaction, currentDate, filter){
  if(!currentDate) currentDate = moment()
  return this.getRange(
    moment(currentDate).subtract(27,'days'),
    moment(currentDate).subtract(20,'days'),
    action,
    subaction,
    filter
  )
}
function getPastThirtyDays(action, subaction, currentDate, filter){
  if(!currentDate) currentDate = moment()
  return this.getRange(
    moment(currentDate).subtract(29,'days'),
    moment(currentDate).add(1,'days'),
    action,
    subaction,
    filter
  )
}

function insightsToResults(fromDate, toDate, insights){
  let days = toDate.diff(fromDate, 'days'),
      results = []

  for(let i=0; i<days; i++){
    results[i] = { date:moment(fromDate).add(i,'day'), value:0 }

    if(insights[0] && results[i].date.isSame(moment(insights[0].date), 'day')){
      results[i].value = insights[0].value
      insights.shift()
    }
  }
  return results
}
function growthInsightsToResults(fromDate, toDate, shareInsights, viewInsights){
  let days = toDate.diff(fromDate, 'days'),
      results = []
  //console.log('growthInsightsToResults', shareInsights, viewInsights)
  for(let i=0; i<days; i++){
    results[i] = { date:moment(fromDate).add(i,'day'), value:0 }

    if(shareInsights[0] && results[i].date.isSame(moment(shareInsights[0].date), 'day')){
      results[i].value = shareInsights[0].value
      shareInsights.shift()
    }
    if(viewInsights[0] && results[i].date.isSame(moment(viewInsights[0].date), 'day')){
      if(viewInsights[0].value!=0)
        results[i].value = _.round(results[i].value * 100 / viewInsights[0].value, 1)
      viewInsights.shift()
    }
  }
  return results
}
function getRangeFromQuery(fromDate, toDate, query){
  let promise
  if(query.action === INACT.GROWTH){
    // Growth is share/view
    delete query.action // we don't need "growth" in query.action
    let shareQuery = _.assign({action:INACT.SHARE}, query),
        viewQuery = _.assign({action:INACT.VIEW}, query)
    promise = Promise.all([
      this.find(shareQuery).sort([['date', 1]]),
      this.find(viewQuery).sort([['date', 1]])
    ])
    .then(results => {
      return growthInsightsToResults(fromDate, toDate, results[0], results[1])
    })

  } else if(query.action === INACT.TREND) {

    promise = Promise.reject(new Error('"trend" getRange not implement yet.'))

  } else {
    // Other action
    promise = this.find(query)
    .sort([['date', 1]])
    .then(insights => {
      //console.log('getRangeFromQuery()', query, insights)
      return insightsToResults(fromDate, toDate, insights)
    })
  }
  return promise
}

function aggregateRangeOf(entity, onAggregateDone){
  return (currentDate, match, sort, limit) => {
    let aggs = []

    // 1. "match" action
    let $match = _.clone(match)
    // for "trend" action, use "view".
    if(match.action === INACT.TREND)
      $match.action = INACT.VIEW
    // for "growth" action, we need both "share" and "view" actions
    else if(match.action === INACT.GROWTH)
      $match = { '$or':[{action:INACT.SHARE}, {action:INACT.VIEW}] }
    //console.log({$match})
    aggs.push({$match})
    //console.log('AGG', match, aggs)

    // 2. "group" insights by entity
    if(!currentDate) currentDate = moment().startOf('day')
    else currentDate.startOf('day')
    const twentySevenDaysAgo = moment(currentDate).subtract(27,'days').toDate(),
          twentyDaysAgo = moment(currentDate).subtract(20,'days').toDate(),
          thirteenDaysAgo = moment(currentDate).subtract(13,'days').toDate(),
          sixDaysAgo = moment(currentDate).subtract(6,'days').toDate(),
          aDayAhead = moment(currentDate).add(1,'days').toDate()
    let $group

    if(match.action === INACT.GROWTH) {
      // 2.1 "$group" for "growth" action
      $group = {
        _id: '$'+entity,
        'shareTwoWeeksAgo': {$sum: {$cond:
          {if: {$and:[
            {$eq:['$action',INACT.SHARE]},
            {$gte:['$date', twentyDaysAgo]},
            {$lt:['$date', thirteenDaysAgo]}
          ]}, then:'$value', else:0 }
        } },
        'shareAWeekAgo': {$sum: {$cond:
          {if: {$and:[
            {$eq:['$action',INACT.SHARE]},
            {$gte:['$date', thirteenDaysAgo]},
            {$lt:['$date', sixDaysAgo]}
          ]}, then:'$value', else:0 }
        } },
        'sharePastSevenDays': {$sum: {$cond:
          {if: {$and:[
            {$eq:['$action',INACT.SHARE]},
            {$gte:['$date', sixDaysAgo]},
            {$lt:['$date', aDayAhead]}
          ]}, then:'$value', else:0 }
        } },
        // overall include not-in-range value as well.
        'shareOverall': {$sum: {$cond:
          {if:{$eq:['$action',INACT.SHARE]}, then:'$value', else:0 }
        } },

        'viewTwoWeeksAgo': {$sum: {$cond:
          {if: {$and:[
            {$eq:['$action',INACT.VIEW]},
            {$gte:['$date', twentyDaysAgo]},
            {$lt:['$date', thirteenDaysAgo]}
          ]}, then:'$value', else:0 }
        } },
        'viewAWeekAgo': {$sum: {$cond:
          {if: {$and:[
            {$eq:['$action',INACT.VIEW]},
            {$gte:['$date', thirteenDaysAgo]},
            {$lt:['$date', sixDaysAgo]}
          ]}, then:'$value', else:0 }
        } },
        'viewPastSevenDays': {$sum: {$cond:
          {if: {$and:[
            {$eq:['$action',INACT.VIEW]},
            {$gte:['$date', sixDaysAgo]},
            {$lt:['$date', aDayAhead]}
          ]}, then:'$value', else:0 }
        } },
        // overall include not-in-range value as well.
        'viewOverall': {$sum: {$cond:
          {if:{$eq:['$action',INACT.VIEW]}, then:'$value', else:0 }
        } }
      }
      // 2.2 "project" "growth" entity insight
      let $project = {
        _id:0,
        //threeWeeksAgo:1,
        twoWeeksAgo: {$cond:{
          if:{$eq:['$viewTwoWeeksAgo', 0]},
          then: {$cond:{if:{$eq:['$shareTwoWeeksAgo', 0]}, then:null, else:0}},
          else: round({$divide:[ {$multiply: ['$shareTwoWeeksAgo', 100] }, '$viewTwoWeeksAgo'] }, 1)
        } },
        aWeekAgo:{$cond:{
          if:{$eq:['$viewAWeekAgo', 0]},
          then: {$cond:{if:{$eq:['$shareAWeekAgo', 0]}, then:null, else:0}},
          else: round({$divide:[ {$multiply: ['$shareAWeekAgo', 100] }, '$viewAWeekAgo'] }, 1)
        } },
        pastSevenDays:{$cond:{
          if:{$eq:['$viewPastSevenDays', 0]},
          then: {$cond:{if:{$eq:['$sharePastSevenDays', 0]}, then:null, else:0}},
          else: round({$divide:[ {$multiply: ['$sharePastSevenDays', 100] }, '$viewPastSevenDays'] }, 1)
        } },
        overall:{$cond:{
          if:{$eq:['$viewOverall', 0]},
          then: {$cond:{if:{$eq:['$shareOverall', 0]}, then:null, else:0}},
          else: round({$divide:[ {$multiply: ['$shareOverall', 100] }, '$viewOverall'] }, 1)
        } }
        //viewTwoWeeksAgo:1, viewAWeekAgo:1, viewPastSevenDays:1, viewOverall:1, // remove out
        //shareTwoWeeksAgo:1, shareAWeekAgo:1, sharePastSevenDays:1, shareOverall:1 // remove out
      }
      $project[entity] = '$_id'
      aggs.push({$group}, {$project})

    } else if(match.action === INACT.VIEW) {
      // 2.1 "$group" for "growth" action
      $group = {
        _id: '$'+entity,
        threeWeeksAgo: {$sum: {$cond:
          {if: {$and:[
            {$gte:['$date', twentySevenDaysAgo]},
            {$lt:['$date', twentyDaysAgo]}
          ]}, then:'$value', else:0 }
        } },
        twoWeeksAgo: {$sum: {$cond:
          {if: {$and:[
            {$gte:['$date', twentyDaysAgo]},
            {$lt:['$date', thirteenDaysAgo]}
          ]}, then:'$value', else:0 }
        } },
        aWeekAgo: {$sum: {$cond:
          {if: {$and:[
            {$gte:['$date', thirteenDaysAgo]},
            {$lt:['$date', sixDaysAgo]}
          ]}, then:'$value', else:0 }
        } },
        pastSevenDays: {$sum: {$cond:
          {if: {$and:[
            {$gte:['$date', sixDaysAgo]},
            {$lt:['$date', aDayAhead]}
          ]}, then:'$value', else:0 }
        } },
        // overall include not-in-range value as well.
        overall: {$sum: '$value' }
      }
      // 2.2 "project" "growth" entity insight
      let $project = {
        _id:0,
        //threeWeeksAgo:1,
        // 2.2.1 VIEW SCORE
        twoWeeksAgo: {$cond:{if:{$eq:['$twoWeeksAgo', 0]}, then:null, else:'$twoWeeksAgo'}},
        aWeekAgo: {$cond:{if:{$eq:['$aWeekAgo', 0]}, then:null, else:'$aWeekAgo'}},
        pastSevenDays:  {$cond:{if:{$eq:['$pastSevenDays', 0]}, then:null, else:'$pastSevenDays'}},
        overall: {$cond:{if:{$eq:['$overall', 0]}, then:null, else:'$overall'}},

        // 2.2.2 TREND SCORE, overall is no need cause it's a trend compare current to prev score
        trend: {
          twoWeeksAgo: { $cond:{
            if: {$eq:['$threeWeeksAgo', 0]},
            then: {$cond:{if:{$eq:['$twoWeeksAgo', 0]}, then:null, else:0}},
            else: round({$divide:[ {$multiply: [{$subtract: ['$twoWeeksAgo', '$threeWeeksAgo']}, 100] }, '$threeWeeksAgo'] }, 1)
          } },
          aWeekAgo: { $cond:{
            if: {$eq:['$twoWeeksAgo', 0]},
            then: {$cond:{if:{$eq:['$aWeekAgo', 0]}, then:null, else:0}},
            else: round({$divide:[ {$multiply: [{$subtract: ['$aWeekAgo', '$twoWeeksAgo']}, 100] }, '$twoWeeksAgo'] }, 1)
          } },
          pastSevenDays: { $cond:{
            if: {$eq:['$aWeekAgo', 0]},
            then: {$cond:{if:{$eq:['$pastSevenDays', 0]}, then:null, else:0}},
            else: round({$divide:[ {$multiply: [{$subtract: ['$pastSevenDays', '$aWeekAgo']}, 100] }, '$aWeekAgo'] }, 1)
          } }
        }
      }
      $project[entity] = '$_id'
      aggs.push({$group}, {$project})

    } else if(match.action === INACT.TREND){
      // 2.1 "$group" for "growth" action
      $group = {
        _id: '$'+entity,
        threeWeeksAgo: {$sum: {$cond:
          {if: {$and:[
            {$gte:['$date', twentySevenDaysAgo]},
            {$lt:['$date', twentyDaysAgo]}
          ]}, then:'$value', else:0 }
        } },
        twoWeeksAgo: {$sum: {$cond:
          {if: {$and:[
            {$gte:['$date', twentyDaysAgo]},
            {$lt:['$date', thirteenDaysAgo]}
          ]}, then:'$value', else:0 }
        } },
        aWeekAgo: {$sum: {$cond:
          {if: {$and:[
            {$gte:['$date', thirteenDaysAgo]},
            {$lt:['$date', sixDaysAgo]}
          ]}, then:'$value', else:0 }
        } },
        pastSevenDays: {$sum: {$cond:
          {if: {$and:[
            {$gte:['$date', sixDaysAgo]},
            {$lt:['$date', aDayAhead]}
          ]}, then:'$value', else:0 }
        } },
        // overall include not-in-range value as well.
        overall: {$sum: '$value' }
      }
      // 2.2 "project" "growth" entity insight
      let $project = {
        _id:0,
        //threeWeeksAgo:1,
        // 2.2.1 TREND SCORE, overall is no need cause it's a trend compare current to prev score
        twoWeeksAgo: { $cond:{
          if: {$eq:['$threeWeeksAgo', 0]},
          then: {$cond:{if:{$eq:['$twoWeeksAgo', 0]}, then:null, else:0}},
          else: round({$divide:[ {$multiply: [{$subtract: ['$twoWeeksAgo', '$threeWeeksAgo']}, 100] }, '$threeWeeksAgo'] }, 1)
        } },
        aWeekAgo: { $cond:{
          if: {$eq:['$twoWeeksAgo', 0]},
          then: {$cond:{if:{$eq:['$aWeekAgo', 0]}, then:null, else:0}},
          else: round({$divide:[ {$multiply: [{$subtract: ['$aWeekAgo', '$twoWeeksAgo']}, 100] }, '$twoWeeksAgo'] }, 1)
        } },
        pastSevenDays: { $cond:{
          if: {$eq:['$aWeekAgo', 0]},
          then: {$cond:{if:{$eq:['$pastSevenDays', 0]}, then:null, else:0}},
          else: round({$divide:[ {$multiply: [{$subtract: ['$pastSevenDays', '$aWeekAgo']}, 100] }, '$aWeekAgo'] }, 1)
        } },

        // 2.2.2 VIEW SCORE
        view: {
          twoWeeksAgo: {$cond:{if:{$eq:['$twoWeeksAgo', 0]}, then:null, else:'$twoWeeksAgo'}},
          aWeekAgo: {$cond:{if:{$eq:['$aWeekAgo', 0]}, then:null, else:'$aWeekAgo'}},
          pastSevenDays: {$cond:{if:{$eq:['$pastSevenDays', 0]}, then:null, else:'$pastSevenDays'}},
          overall: {$cond:{if:{$eq:['$overall', 0]}, then:null, else:'$overall'}}
        }
      }
      $project[entity] = '$_id'
      aggs.push({$group}, {$project})
    } else {
      // For other actions

      // 2.1 "$group" for other actions except "growth"
      $group = {
        _id: '$'+entity,
        // threeWeeksAgo: {$sum: {$cond:
        //   {if: {$and:[
        //     {$gte:['$date', twentySevenDaysAgo]},
        //     {$lt:['$date', twentyDaysAgo]}
        //   ]}, then:'$value', else:0 }
        // } },
        twoWeeksAgo: {$sum: {$cond:
          {if: {$and:[
            {$gte:['$date', twentyDaysAgo]},
            {$lt:['$date', thirteenDaysAgo]}
          ]}, then:'$value', else:0 }
        } },
        aWeekAgo: {$sum: {$cond:
          {if: {$and:[
            {$gte:['$date', thirteenDaysAgo]},
            {$lt:['$date', sixDaysAgo]}
          ]}, then:'$value', else:0 }
        } },
        pastSevenDays: {$sum: {$cond:
          {if: {$and:[
            {$gte:['$date', sixDaysAgo]},
            {$lt:['$date', aDayAhead]}
          ]}, then:'$value', else:0 }
        } },
        // overall include not-in-range value as well.
        overall: {$sum: '$value' }
      }
      // 2.2 "project" entity insights
      let $project = {
        _id:0,
        //threeWeeksAgo:1,
        twoWeeksAgo: {$cond:{if:{$eq:['$twoWeeksAgo', 0]}, then:null, else:'$twoWeeksAgo'}},
        aWeekAgo: {$cond:{if:{$eq:['$aWeekAgo', 0]}, then:null, else:'$aWeekAgo'}},
        pastSevenDays:  {$cond:{if:{$eq:['$pastSevenDays', 0]}, then:null, else:'$pastSevenDays'}},
        overall: {$cond:{if:{$eq:['$overall', 0]}, then:null, else:'$overall'}}
      }
      $project[entity] = '$_id'
      // // assign project "trend" for view/trend action
      // if(match.action === INACT.VIEW || match.action === INACT.TREND){
      //   $project.trend = { $cond:{
      //     if:{$eq:['$threeWeeksAgo', 0]},
      //     then: 0,
      //     else: round({$divide:[ {$multiply: [{$subtract: ['$twoWeeksAgo', '$threeWeeksAgo']}, 100] }, '$threeWeeksAgo'] }, 1)
      //   } }
      // }
      aggs.push({$group}, {$project})

    }

    // 3. "facet" creation
    // sum / avg overall
    let groupSummary
    if(match.action === INACT.GROWTH || match.action === INACT.TREND){
      groupSummary = {
        _id: null,
        twoWeeksAgo: {$avg:'$twoWeeksAgo'},
        aWeekAgo: {$avg:'$aWeekAgo'},
        pastSevenDays: {$avg:'$pastSevenDays'},
        overall: {$avg:'$overall'},
        count: {$sum:1}
      }
    } else {
      groupSummary = {
        _id: null,
        twoWeeksAgo: {$sum:'$twoWeeksAgo'},
        aWeekAgo: {$sum:'$aWeekAgo'},
        pastSevenDays: {$sum:'$pastSevenDays'},
        overall: {$sum:'$overall'},
        count: {$sum:1}
      }
    }
    let $facet = {
      'entries':[
        {$sort: sort || {pastSevenDays: -1}},
        // limit only applied for 'entries', not 'summary'
        {$limit: limit || setting.INSIGHT.LIMIT}
      ],
      // sum of all entries into each period
      'summary':[
        {$group: groupSummary},
        {$project: {_id:0}}
      ]
    }
    aggs.push({$facet})

    //console.log('AGG', aggs)
    return mongoose.model(_.capitalize(entity)+'Insight').aggregate(aggs)
    .then(onAggregateDone)
  }
}

// entityObj is {key: id} e.g. {story: 31}
// subaction is optional
// updateDate is optional data needed to update along with value increment.
//    no need to specified {$inc: {value: 1}} cause it'll auto append.
function inc(entityObj, action, subaction, updateData, onDone){
  let key = _.keys(entityObj)[0],
      id = _.values(entityObj)[0],
      model = mongoose.model(_.capitalize(key)+'Insight')

  if(action==null || !key || id==null) throw new Error('Action and entityObj must be specified.')

  let query = {
    action:action,
    subaction:subaction,
    date:new Date().setHours(0,0,0,0) // normalized date to midnight
  }
  query[key] = id
  if(query.subaction==null)
    delete query.subaction

  if(!updateData) updateData = {}
  updateData.$inc = {value: 1}

  return model.update(
    query,
    updateData,
    {upsert:true, runValidators:true}
  )
  .then(raw => {
    //console.log('UPDATED', query, updateData, onDone, raw)
    if(!onDone || !raw.ok || raw.n === 0) return

    return onDone()
  })
  .catch(e => {
    // dup key upsert; non atomic operation
    if(e.code === 11000){
      // reupdate
      model.update(
        query,
        updateData,
        {upsert:true, runValidators:true}
      )
      .then(raw => {
        if(!onDone || !raw.ok || raw.n === 0) return

        return onDone()
      })
    }
    else throw e
  })
}

let storyInsightSchema = new Schema({
  // Date is unique and index => should be insight id
  date: {
    required: [true, 'Date is required.'],
    type: Date
  },

  action: {
    required: [true, 'Action is required.'],
    type: Number,
    enum: _.values(INACT)
  },

  subaction: {
    type: Number,
    enum: _.values(setting.INSIGHT_SUBACTION)
  },

  story: {
    required: [true, 'Story is required.'],
    type: Number,
    ref: 'Story'
  },

  // not likely to change, it's okay to store here.
  contentType: String,
  // this number can be negative e.g. when decrement
  value: {
    type: Number,
    default: 0
  },

  // optional variable data
  var: Schema.Types.Mixed
})
storyInsightSchema.plugin(plugins.updateCreate)
storyInsightSchema.index({date:1, action:1, story:1}, {unique: true})

//storyInsightSchema.statics.inc = function(date, action, sid, contentType, nestingUpdate, subaction){
storyInsightSchema.statics.inc = function(sid, action, subaction, contentType, nestingUpdate){
  if(nestingUpdate==null) nestingUpdate = true

  return inc(
    {story:sid},
    action,
    subaction,
    {contentType:contentType},

    !nestingUpdate ? null : () => {
      return Story.findById(sid, {column:1, publisher:1, writer:1})
      .then(s => {
        // update columnInsight
        if(s.column) ColumnInsight.inc(s.column, action, subaction)

        // update publisherInsight
        PublisherInsight.inc(s.publisher, action, subaction)

        // update writerInsight
        WriterInsight.inc(s.writer, action, subaction)
      })
    }
  )
}

/* Inputs:
  The example filter of insights; "view stat of all quizz stories"
  filter: {
    story: null, // all stories, or story id to scope only one story
    contentType: 'QUIZZ'
  }
  NOTE: fromDate and toDate will be set to midnight.<br/>
  Select the date range carefully, for example, past 7 days means fromDate is "today subtracted by 6 days at midnight" <br/>
  to toDate that is "today adding 1 day at midnight"
*/
/* Response:
  [
    // sorted by date order
    { date: Date, value: 311 },
    { date: Date, value: 11 }
  ]
*/
storyInsightSchema.statics.getRange = function(fromDate, toDate, action, subaction, filter){
  //console.log('getRange()', toDate.diff(fromDate), moment(fromDate), moment(toDate), action, subaction, filter)
  // normalize to midnight
  // make sure it's moment
  fromDate = moment(fromDate).startOf('day')
  toDate = moment(toDate).startOf('day')
  if(toDate.diff(fromDate) <= 0) throw new Error('"fromDate" must be less than "toDate" at least one day.')
  if(action==null) throw new Error('"action" is required.')

  let query = {}
  if(filter && filter.story) query.story = filter.story
  if(filter && filter.contentType) query.contentType = filter.contentType
  query.date = {$gte:fromDate.toDate(), $lte:toDate.toDate()}
  query.action = action
  if(subaction!=null) query.subaction = subaction

  return this.getRangeFromQuery(fromDate, toDate, query)
}

storyInsightSchema.statics.aggregateRange = aggregateRangeOf('story', result => {
  // since $avg can't be rounded, round it here.
  let summary = result[0].summary[0] || {}
  for(let key in summary)
    summary[key] = _.round(summary[key] ,1)

  let promises = []
  for(let i=0; i<result[0].entries.length; i++){
    let sid = result[0].entries[i].story

    promises.push(
      Story.findById(sid, {title:1, column:1, writer:1, status:1, slug:1})
      .populate({
        path:'writer',
        select:'display username'
      })
      .then(s => {
        // no entry found, it may be removed, just return its id
        if(!s) return result[0].entries[i]

        s = helpers.stashAndUrlStory(s.toJSON())
        s.writer = helpers.stashAndUrlUser(s.writer)
        result[0].entries[i].story = s
        return result[0].entries[i]
      })
    )
  }
  return Promise.all(promises)
  .then(entries => {
    //console.log('entries', entries)
    return {
      entries: entries,
      summary: summary
    }
  })
})
// sort must be format {sortKey, -1/1}
storyInsightSchema.statics.sumRange = function(currentDate, action, subaction, filter, sort, limit){
  if(action==null) throw new Error('Action must be specified.')

  let match = filter || {}
  match.action = action
  if(subaction!=null) match.subaction = subaction
  //console.log('match', match)
  return this.aggregateRange(currentDate, match, sort, limit)
}
storyInsightSchema.statics.getRangeFromQuery = getRangeFromQuery
storyInsightSchema.statics.getPastSevenDays = getPastSevenDays
storyInsightSchema.statics.getAWeekAgo = getAWeekAgo
storyInsightSchema.statics.getTwoWeeksAgo = getTwoWeeksAgo
storyInsightSchema.statics.getThreeWeeksAgo = getThreeWeeksAgo
storyInsightSchema.statics.getPastThirtyDays = getPastThirtyDays

let StoryInsight = mongoose.model('StoryInsight', storyInsightSchema);


let writerInsightSchema = new Schema({
  // Date is unique and index => should be insight id
  date: {
    required: [true, 'Date is required.'],
    type: Date
  },

  action: {
    required: [true, 'Action is required.'],
    type: Number,
    enum: _.values(INACT)
  },

  subaction: {
    type: Number,
    enum: _.values(setting.INSIGHT_SUBACTION)
  },

  writer: {
    required: [true, 'Writer is required.'],
    type: Number,
    ref: 'Writer'
  },

  value: {
    type: Number,
    default: 0
  },

  // optional variable data
  var: Schema.Types.Mixed
})
writerInsightSchema.plugin(plugins.updateCreate)
writerInsightSchema.index({date:1, action:1, writer:1}, {unique: true})

writerInsightSchema.statics.inc = function(uid, action, subaction){
  return inc(
    {writer:uid},
    action,
    subaction
  )
}

/* Inputs:
  The example filter of insights; "view stat of all writers"
  filter: {
    writer: null // all writers, or writer id to scope only one writer
  }
  NOTE: fromDate and toDate will be set to midnight.<br/>
  Select the date range carefully, for example, past 7 days means fromDate is "today subtracted by 6 days at midnight" <br/>
  to toDate that is "today adding 1 day at midnight"
*/
/* Response:
  [
    // sorted by date order
    { date: Date, value: 311 },
    { date: Date, value: 11 }
  ]
*/
writerInsightSchema.statics.getRange = function(fromDate, toDate, action, subaction, filter){
  // normalize to midnight
  // make sure it's moment
  fromDate = moment(fromDate).startOf('day')
  toDate = moment(toDate).startOf('day')
  if(fromDate >= toDate) throw new Error('"fromDate" must be less than "toDate" at least one day.')
  if(action==null) throw new Error('"action" is required.')

  let query = {}
  if(filter && filter.writer) query.writer = filter.writer
  query.action = action
  if(subaction!=null) query.subaction = subaction
  query.date = {$gte:fromDate.toDate(), $lte:toDate.toDate()}

  return this.getRangeFromQuery(fromDate, toDate, query)
}

writerInsightSchema.statics.aggregateRange = aggregateRangeOf('writer', result => {
  // since $avg can't be rounded, round it here.
  let summary = result[0].summary[0] || {}
  for(let key in summary)
    summary[key] = _.round(summary[key] ,1)

  let promises = []
  for(let i=0; i<result[0].entries.length; i++){
    let uid = result[0].entries[i].writer

    promises.push(
      User.findById(uid, {display:1, username:1})
      .then(u => {
        // no entry found, it may be removed, just return its id
        if(!u) return result[0].entries[i]

        u = helpers.stashAndUrlUser(u.toJSON())
        result[0].entries[i].writer = u
        return result[0].entries[i]
      })
    )
  }
  return Promise.all(promises)
  .then(entries => {
    //console.log('entries', entries)
    return {
      entries: entries,
      summary: summary
    }
  })
})
// sort must be format {sortKey, -1/1}
writerInsightSchema.statics.sumRange = function(currentDate, action, subaction, filter, sort, limit){
  if(action==null) throw new Error('Action must be specified.')

  let match = filter || {}
  match.action = action
  if(subaction!=null) match.subaction = subaction
  //console.log('match', match)
  return this.aggregateRange(currentDate, match, sort, limit)
}
writerInsightSchema.statics.getRangeFromQuery = getRangeFromQuery
writerInsightSchema.statics.getPastSevenDays = getPastSevenDays
writerInsightSchema.statics.getAWeekAgo = getAWeekAgo
writerInsightSchema.statics.getTwoWeeksAgo = getTwoWeeksAgo
writerInsightSchema.statics.getThreeWeeksAgo = getThreeWeeksAgo
writerInsightSchema.statics.getPastThirtyDays = getPastThirtyDays

let WriterInsight = mongoose.model('WriterInsight', writerInsightSchema);


let columnInsightSchema = new Schema({
  // Date is unique and index => should be insight id
  date: {
    required: [true, 'Date is required.'],
    type: Date
  },

  action: {
    required: [true, 'Action is required.'],
    type: Number,
    enum: _.values(INACT)
  },

  subaction: {
    type: Number,
    enum: _.values(setting.INSIGHT_SUBACTION)
  },

  column: {
    required: [true, 'Column is required.'],
    type: Number,
    ref: 'Column'
  },

  value: {
    type: Number,
    default: 0
  },

  // optional variable data
  var: Schema.Types.Mixed
})
columnInsightSchema.plugin(plugins.updateCreate)
columnInsightSchema.index({date:1, action:1, column:1}, {unique: true})
columnInsightSchema.statics.inc = function(cid, action, subaction){
  return inc(
    {column:cid},
    action,
    subaction
  )
}

/* Inputs:
  The example filter of insights; "view stat of all columns"
  filter: {
    column: null // all columns, or column id to scope only one column
  }
  NOTE: fromDate and toDate will be set to midnight.<br/>
  Select the date range carefully, for example, past 7 days means fromDate is "today subtracted by 6 days at midnight" <br/>
  to toDate that is "today adding 1 day at midnight"
*/
/* Response:
  [
    // sorted by date order
    { date: Date, value: 311 },
    { date: Date, value: 11 }
  ]
*/
columnInsightSchema.statics.getRange = function(fromDate, toDate, action, subaction, filter){
  // normalize to midnight
  // make sure it's moment
  fromDate = moment(fromDate).startOf('day')
  toDate = moment(toDate).startOf('day')
  if(fromDate >= toDate) throw new Error('"fromDate" must be less than "toDate" at least one day.')
  if(action==null) throw new Error('"action" is required.')

  let query = {}
  if(filter && filter.column) query.column = filter.column
  query.action = action
  if(subaction!=null) query.subaction = subaction
  query.date = {$gte:fromDate.toDate(), $lte:toDate.toDate()}

  return this.getRangeFromQuery(fromDate, toDate, query)
}

columnInsightSchema.statics.aggregateRange = aggregateRangeOf('column', result => {
  // since $avg can't be rounded, round it here.
  let summary = result[0].summary[0] || {}
  for(let key in summary)
    summary[key] = _.round(summary[key] ,1)

  let promises = []
  for(let i=0; i<result[0].entries.length; i++){
    let cid = result[0].entries[i].column

    promises.push(
      Column.findById(cid, {name:1, slug:1})
      .then(c => {
        // no entry found, it may be removed, just return its id
        if(!c) return result[0].entries[i]

        c = helpers.stashAndUrlColumn(c.toJSON())
        result[0].entries[i].column = c
        return result[0].entries[i]
      })
    )
  }
  return Promise.all(promises)
  .then(entries => {
    //console.log('entries', entries)
    return {
      entries: entries,
      summary: summary
    }
  })
})
// sort must be format {sortKey, -1/1}
columnInsightSchema.statics.sumRange = function(currentDate, action, subaction, filter, sort, limit){
  if(action==null) throw new Error('Action must be specified.')

  let match = filter || {}
  match.action = action
  if(subaction!=null) match.subaction = subaction
  //console.log('match', match)
  return this.aggregateRange(currentDate, match, sort, limit)
}
columnInsightSchema.statics.getRangeFromQuery = getRangeFromQuery
columnInsightSchema.statics.getPastSevenDays = getPastSevenDays
columnInsightSchema.statics.getAWeekAgo = getAWeekAgo
columnInsightSchema.statics.getTwoWeeksAgo = getTwoWeeksAgo
columnInsightSchema.statics.getThreeWeeksAgo = getThreeWeeksAgo
columnInsightSchema.statics.getPastThirtyDays = getPastThirtyDays

let ColumnInsight = mongoose.model('ColumnInsight', columnInsightSchema);


let publisherInsightSchema = new Schema({
  // Date is unique and index => should be insight id
  date: {
    required: [true, 'Story is required.'],
    type: Date
  },

  action: {
    required: [true, 'Action is required.'],
    type: Number,
    enum: _.values(INACT)
  },

  subaction: {
    type: Number,
    enum: _.values(setting.INSIGHT_SUBACTION)
  },

  publisher: {
    required: [true, 'Publisher is required.'],
    type: Number,
    ref: 'Publisher'
  },

  value: {
    type: Number,
    default: 0
  },

  // optional variable data
  var: Schema.Types.Mixed
})
publisherInsightSchema.plugin(plugins.updateCreate)
publisherInsightSchema.index({date:1, action:1, publisher:1}, {unique: true})

publisherInsightSchema.statics.inc = function(pid, action, subaction){
  return inc(
    {publisher:pid},
    action,
    subaction
  )
}

/* Inputs:
  The example filter of insights; "view stat of all publishers"
  filter: {
    publisher: null // all publishers, or publisher id to scope only one publisher
  }
  NOTE: fromDate and toDate will be set to midnight.<br/>
  Select the date range carefully, for example, past 7 days means fromDate is "today subtracted by 6 days at midnight" <br/>
  to toDate that is "today adding 1 day at midnight"
*/
/* Response:
  [
    // sorted by date order
    { date: Date, value: 311 },
    { date: Date, value: 11 }
  ]
*/
publisherInsightSchema.statics.getRange = function(fromDate, toDate, action, subaction, filter){
  // normalize to midnight
  // make sure it's moment
  fromDate = moment(fromDate).startOf('day')
  toDate = moment(toDate).startOf('day')
  if(fromDate >= toDate) throw new Error('"fromDate" must be less than "toDate" at least one day.')
  if(action==null) throw new Error('"action" is required.')

  let query = {}
  if(filter && filter.publisher) query.publisher = filter.publisher
  query.action = action
  if(subaction!=null) query.subaction = subaction
  query.date = {$gte:fromDate.toDate(), $lte:toDate.toDate()}

  return this.getRangeFromQuery(fromDate, toDate, query)
}

publisherInsightSchema.statics.aggregateRange = aggregateRangeOf('publisher', result => {
  // since $avg can't be rounded, round it here.
  let summary = result[0].summary[0] || {}
  for(let key in summary)
    summary[key] = _.round(summary[key] ,1)

  let promises = []
  for(let i=0; i<result[0].entries.length; i++){
    let pid = result[0].entries[i].publisher

    promises.push(
      Publisher.findById(pid, {name:1})
      .then(p => {
        // no entry found, it may be removed, just return its id
        if(!p) return result[0].entries[i]

        result[0].entries[i].publisher = p.toJSON()
        return result[0].entries[i]
      })
    )
  }
  return Promise.all(promises)
  .then(entries => {
    //console.log('entries', entries)
    return {
      entries: entries,
      summary: summary
    }
  })
})
// sort must be format {sortKey, -1/1}
publisherInsightSchema.statics.sumRange = function(currentDate, action, subaction, filter, sort, limit){
  if(action==null) throw new Error('Action must be specified.')

  let match = filter || {}
  match.action = action
  if(subaction!=null) match.subaction = subaction
  //console.log('match', match)
  return this.aggregateRange(currentDate, match, sort, limit)
}
publisherInsightSchema.statics.getRangeFromQuery = getRangeFromQuery
publisherInsightSchema.statics.getPastSevenDays = getPastSevenDays
publisherInsightSchema.statics.getAWeekAgo = getAWeekAgo
publisherInsightSchema.statics.getTwoWeeksAgo = getTwoWeeksAgo
publisherInsightSchema.statics.getThreeWeeksAgo = getThreeWeeksAgo
publisherInsightSchema.statics.getPastThirtyDays = getPastThirtyDays

let PublisherInsight = mongoose.model('PublisherInsight', publisherInsightSchema);


module.exports = {
	User : User,
  Story : Story,
  Column: Column,
  Publisher: Publisher,
  //Invite: Invite,
  Tag: Tag,
  Role: Role,
  Comment: Comment,
  Tag: Tag,
  Contact: Contact,

  StoryInsight: StoryInsight,
  ColumnInsight: ColumnInsight,
  PublisherInsight: PublisherInsight,
  WriterInsight: WriterInsight,

  Hash: Hash
  //SuperAdmin: SuperAdmin
}
