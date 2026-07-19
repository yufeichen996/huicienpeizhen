Component({
  properties: {
    primaryText: { type: String, value: '下一步' },
    secondaryText: { type: String, value: '上一步' },
    disabled: { type: Boolean, value: false },
    loading: { type: Boolean, value: false },
    totalText: { type: String, value: '' },
  },
  methods: {
    onPrimary() { if (!this.properties.disabled && !this.properties.loading) this.triggerEvent('primary') },
    onSecondary() { this.triggerEvent('secondary') },
  },
})
