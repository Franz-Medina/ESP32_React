import { createThingsBoardUser } from "../services/thingsboardService.js"

export async function register(req, res) {

  try {

    const { email, password } = req.body

    const newUser = {
      email: email,
      authority: "CUSTOMER_USER",
      password: password
    }

    const result = await createThingsBoardUser(newUser)

    res.status(201).json({
      message: "Account created successfully",
      user: result
    })

  } catch (error) {

    console.error(error)

    res.status(500).json({
      message: "Failed to create account"
    })
  }
}