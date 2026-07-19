import { userStore } from '../stores/user'
export const userService = { simulateLogin: () => new Promise((resolve) => setTimeout(() => resolve(userStore.login()), 450)), logout: () => userStore.logout(), updateProfile: userStore.update.bind(userStore), getCurrentUser: () => userStore.getCurrentUser(), requireLogin: () => userStore.isLoggedIn() }
