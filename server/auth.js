import bcrypt from 'bcryptjs'
import { db } from './db.js'

export function getAdmin() {
  return db.prepare('SELECT * FROM admin WHERE id = 1').get()
}

export function verifyLogin(username, password) {
  const admin = getAdmin()
  if (!admin) return false
  if (admin.username !== username) return false
  return bcrypt.compareSync(password, admin.password_hash)
}

export function setPassword(username, password) {
  const hash = bcrypt.hashSync(password, 10)
  const existing = getAdmin()
  if (existing) {
    db.prepare('UPDATE admin SET username = ?, password_hash = ? WHERE id = 1').run(username, hash)
  } else {
    db.prepare('INSERT INTO admin (id, username, password_hash) VALUES (1, ?, ?)').run(username, hash)
  }
}

export function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next()
  return res.status(401).json({ error: 'Not authenticated' })
}
