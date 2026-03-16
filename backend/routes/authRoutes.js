import express from "express"
import axios from "axios"

const router = express.Router()

router.post("/register", async (req, res) => {

  try {

    const { email, password } = req.body

    // login as tenant admin
    const login = await axios.post(`${process.env.TB_URL}/api/auth/login`, {
      username: process.env.TB_USERNAME,
      password: process.env.TB_PASSWORD
    })

    const token = login.data.token

    // create user
    const newUser = await axios.post(
      `${process.env.TB_URL}/api/user`,
      {
        email: email,
        authority: "CUSTOMER_USER",
        password: password
      },
      {
        headers: {
          "X-Authorization": `Bearer ${token}`
        }
      }
    )

    res.status(201).json(newUser.data)

  } catch (error) {

    console.error(error.response?.data || error.message)

    res.status(500).json({
      message: "Failed to create account"
    })

  }

})

export default router