import { mockUser } from '../mocks/user'
import type { UserProfile } from '../types/user'
import { storage } from '../utils/storage'
import { StorageKeys } from '../utils/storage-keys'
const guest = (): UserProfile => ({ ...mockUser, nickname: '', avatar: '/assets/images/avatar-default.svg', phoneMasked: '', membershipLevel: 'normal', couponCount: 0, favoriteCount: 0, patientCount: 0, isLoggedIn: false })
class UserStore { private user = guest(); hydrate() { this.user = storage.get<UserProfile>(StorageKeys.userProfile, guest()) } getCurrentUser() { return { ...this.user } } isLoggedIn() { return this.user.isLoggedIn } login() { this.user = { ...mockUser, isLoggedIn: true }; this.persist(); return this.getCurrentUser() } logout() { this.user = guest(); this.persist(); storage.remove(StorageKeys.userSensitiveCache) } update(patch: Partial<UserProfile>) { this.user = { ...this.user, ...patch }; this.persist(); return this.getCurrentUser() } private persist() { storage.set(StorageKeys.userProfile, this.user) } }
export const userStore = new UserStore()
