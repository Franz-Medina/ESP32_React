import { useState } from "react";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  app.post('/register', async (req, res) => {
  console.log("REGISTER HIT", req.body);

  const { email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *',
      [email, hashedPassword]
    );

    console.log("USER CREATED:", result.rows[0]);

    res.status(201).json({ message: 'User created' });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

  return (
    <div>
      <h2>Register</h2>

      <input
        type="email"
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={handleRegister}>Register</button>
    </div>
  );
}

export default Register;