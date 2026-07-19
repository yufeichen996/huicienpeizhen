import { companionService } from '../../services/companion'
import type { CompanionRegistrationInput } from '../../types/domain'
import { getSession } from '../../utils/auth'

const SKILLS = [
  { id: 'full', name: '全程陪诊' },
  { id: 'exam', name: '检查陪同' },
  { id: 'medicine', name: '代取药物' },
  { id: 'inpatient', name: '住院陪护' },
]

const HOSPITALS = [
  { id: 'ruijin', name: '上海瑞金医院' },
  { id: 'huashan', name: '华山医院' },
  { id: 'renji', name: '仁济医院' },
  { id: 'zhongshan', name: '中山医院' },
]

const DISTRICTS = ['黄浦区', '静安区', '浦东新区', '徐汇区', '杨浦区', '普陀区']

const skillViews = (selected: string[]) =>
  SKILLS.map((item) => ({ ...item, selected: selected.includes(item.id) }))
const hospitalViews = (selected: string[]) =>
  HOSPITALS.map((item) => ({ ...item, selected: selected.includes(item.id) }))
const districtViews = (selected: string[]) =>
  DISTRICTS.map((name) => ({ name, selected: selected.includes(name) }))

Page({
  data: {
    loading: false,
    name: '',
    phone: '',
    identityNumber: '',
    gender: 'female' as 'male' | 'female',
    workingYearsText: '',
    introduction: '',
    skills: skillViews([]),
    hospitals: hospitalViews([]),
    districts: districtViews([]),
    selectedSkillIds: [] as string[],
    selectedHospitalIds: [] as string[],
    selectedDistricts: [] as string[],
    identityImagePaths: [] as string[],
    certificatePaths: [] as string[],
    agreementAccepted: false,
    resubmitting: false,
  },

  async onLoad() {
    const session = getSession()
    if (session?.profile.accountStatus === 'APPROVED') {
      wx.reLaunch({ url: '/pages/workbench/index' })
      return
    }
    if (session?.profile.accountStatus === 'PENDING_REVIEW') {
      wx.reLaunch({ url: '/pages/review-status/index' })
      return
    }
    try {
      const application = await companionService.getApplication()
      if (application?.status !== 'REJECTED') return
      this.setData({
        name: application.name,
        gender: application.gender,
        workingYearsText: `${application.workingYears}`,
        introduction: application.introduction,
        selectedSkillIds: [...application.skillServiceIds],
        selectedHospitalIds: [...application.serviceHospitalIds],
        selectedDistricts: [...application.serviceDistricts],
        skills: skillViews(application.skillServiceIds),
        hospitals: hospitalViews(application.serviceHospitalIds),
        districts: districtViews(application.serviceDistricts),
        resubmitting: true,
      })
    } catch {
      // 新申请无需预填。
    }
  },

  onNameInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ name: event.detail.value })
  },

  onPhoneInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ phone: event.detail.value })
  },

  onIdentityInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ identityNumber: event.detail.value })
  },

  onYearsInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ workingYearsText: event.detail.value })
  },

  onIntroductionInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ introduction: event.detail.value })
  },

  selectGender(event: WechatMiniprogram.TouchEvent) {
    this.setData({ gender: event.currentTarget.dataset.gender as 'male' | 'female' })
  },

  toggleSkill(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as string
    const selected = this.data.selectedSkillIds
    const nextSelected = selected.includes(id)
      ? selected.filter((item) => item !== id)
      : [...selected, id]
    this.setData({
      selectedSkillIds: nextSelected,
      skills: skillViews(nextSelected),
    })
  },

  toggleHospital(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as string
    const selected = this.data.selectedHospitalIds
    const nextSelected = selected.includes(id)
      ? selected.filter((item) => item !== id)
      : [...selected, id]
    this.setData({
      selectedHospitalIds: nextSelected,
      hospitals: hospitalViews(nextSelected),
    })
  },

  toggleDistrict(event: WechatMiniprogram.TouchEvent) {
    const district = event.currentTarget.dataset.district as string
    const selected = this.data.selectedDistricts
    const nextSelected = selected.includes(district)
      ? selected.filter((item) => item !== district)
      : [...selected, district]
    this.setData({
      selectedDistricts: nextSelected,
      districts: districtViews(nextSelected),
    })
  },

  chooseIdentityImages() {
    const remaining = 2 - this.data.identityImagePaths.length
    if (remaining <= 0) return
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success: ({ tempFiles }) => {
        this.setData({
          identityImagePaths: [
            ...this.data.identityImagePaths,
            ...tempFiles.map((file) => file.tempFilePath),
          ],
        })
      },
    })
  },

  chooseCertificates() {
    const remaining = 3 - this.data.certificatePaths.length
    if (remaining <= 0) return
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success: ({ tempFiles }) => {
        this.setData({
          certificatePaths: [
            ...this.data.certificatePaths,
            ...tempFiles.map((file) => file.tempFilePath),
          ],
        })
      },
    })
  },

  previewImage(event: WechatMiniprogram.TouchEvent) {
    const group = event.currentTarget.dataset.group as 'identity' | 'certificate'
    const urls = group === 'identity'
      ? this.data.identityImagePaths
      : this.data.certificatePaths
    wx.previewImage({ current: event.currentTarget.dataset.path as string, urls })
  },

  removeImage(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index)
    const group = event.currentTarget.dataset.group as 'identity' | 'certificate'
    if (group === 'identity') {
      this.setData({
        identityImagePaths: this.data.identityImagePaths.filter((_, itemIndex) => itemIndex !== index),
      })
    } else {
      this.setData({
        certificatePaths: this.data.certificatePaths.filter((_, itemIndex) => itemIndex !== index),
      })
    }
  },

  onAgreementChange(event: WechatMiniprogram.CustomEvent<{ value: string[] }>) {
    this.setData({ agreementAccepted: event.detail.value.includes('accepted') })
  },

  async submit() {
    if (!this.data.agreementAccepted || this.data.loading) {
      if (!this.data.agreementAccepted) wx.showToast({ title: '请先阅读并同意申请协议', icon: 'none' })
      return
    }
    const workingYears = Number(this.data.workingYearsText)
    const serviceSkillNames = SKILLS
      .filter((item) => this.data.selectedSkillIds.includes(item.id))
      .map((item) => item.name)
    const serviceHospitalNames = HOSPITALS
      .filter((item) => this.data.selectedHospitalIds.includes(item.id))
      .map((item) => item.name)
    const input: CompanionRegistrationInput = {
      name: this.data.name,
      phone: this.data.phone,
      gender: this.data.gender,
      identityNumber: this.data.identityNumber,
      workingYears,
      introduction: this.data.introduction,
      skillServiceIds: this.data.selectedSkillIds,
      serviceSkillNames,
      serviceHospitalIds: this.data.selectedHospitalIds,
      serviceHospitalNames,
      serviceDistricts: this.data.selectedDistricts,
      identityImagePaths: this.data.identityImagePaths,
      certificatePaths: this.data.certificatePaths,
    }
    this.setData({ loading: true })
    try {
      await companionService.register(input)
      wx.showModal({
        title: '申请已提交',
        content: '平台审核通过前不会接收任务，也不会出现在客户端推荐列表。',
        showCancel: false,
        success: () => wx.reLaunch({ url: '/pages/review-status/index' }),
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '申请提交失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },
})
