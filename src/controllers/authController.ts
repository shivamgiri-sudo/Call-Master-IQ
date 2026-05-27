import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ success: false, message: 'name, email and password are required' });
    return;
  }

  const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]) as any[];
  if ((existing as any[]).length > 0) {
    res.status(409).json({ success: false, message: 'Email already registered' });
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  const [result] = await db.query(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    [name, email, hash]
  ) as any[];

  const token = jwt.sign(
    { userId: (result as any).insertId },
    process.env.JWT_SECRET as string,
    { expiresIn: '7d' }
  );

  res.status(201).json({ success: true, token, user: { id: (result as any).insertId, name, email, plan: 'free' } });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ success: false, message: 'email and password are required' });
    return;
  }

  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]) as any[];
  const user = (rows as any[])[0];

  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET as string,
    { expiresIn: '7d' }
  );

  res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, plan: user.plan } });
}

export async function me(req: any, res: Response): Promise<void> {
  const [rows] = await db.query(
    'SELECT id, name, email, plan, docs_generated, created_at FROM users WHERE id = ?',
    [req.userId]
  ) as any[];
  const user = (rows as any[])[0];

  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  res.json({ success: true, user });
}
