import { companionService } from '../../services/companion'
import type { SettlementOverview, SettlementRecord } from '../../types/domain'
import { guardApproved } from '../../utils/auth'

interface SettlementView extends SettlementRecord {
  serviceAmountText: string
  adjustmentAmountText: string
  payableAmountText: string
  statusText: string
  statusTone: string
}

const formatAmount = (amount: number): string => {
  const sign = amount < 0 ? '-' : ''
  return `${sign}¥${(Math.abs(amount) / 100).toFixed(2)}`
}

const toSettlementView = (record: SettlementRecord): SettlementView => {
  const statusMeta = {
    PENDING_CONFIRMATION: { text: '待确认', tone: 'orange' },
    CONFIRMED: { text: '待打款', tone: 'blue' },
    PAID: { text: '已结算', tone: 'green' },
  }[record.status]
  return {
    ...record,
    serviceAmountText: formatAmount(record.serviceAmount),
    adjustmentAmountText: formatAmount(record.adjustmentAmount),
    payableAmountText: formatAmount(record.payableAmount),
    statusText: statusMeta.text,
    statusTone: statusMeta.tone,
  }
}

Page({
  data: {
    loading: true,
    overview: null as SettlementOverview | null,
    records: [] as SettlementView[],
    pendingAmountText: '¥0.00',
    paidThisMonthText: '¥0.00',
  },

  onShow() {
    if (!guardApproved()) return
    this.load()
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },

  async load() {
    this.setData({ loading: true })
    try {
      const overview = await companionService.getSettlements()
      this.setData({
        overview,
        records: overview.records.map(toSettlementView),
        pendingAmountText: formatAmount(overview.pendingAmount),
        paidThisMonthText: formatAmount(overview.paidThisMonth),
      })
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : '结算信息加载失败',
        icon: 'none',
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  openRecord(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as string
    const record = this.data.records.find((item) => item.id === id)
    if (!record) return
    wx.showModal({
      title: record.settlementNo,
      content: [
        `结算周期：${record.period}`,
        `服务金额：${record.serviceAmountText}`,
        `平台调整：${record.adjustmentAmountText}`,
        `应结金额：${record.payableAmountText}`,
        `当前状态：${record.statusText}`,
      ].join('\n'),
      showCancel: false,
    })
  },

  contactFinance() {
    wx.showModal({
      title: '结算问题',
      content: '正式环境将在此接入财务工单。陪诊师不能自行修改订单价格或结算金额。',
      showCancel: false,
    })
  },
})
