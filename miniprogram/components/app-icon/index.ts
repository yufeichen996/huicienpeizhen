const V3_VARIANTS = ['outline', 'tile', 'tab-unselected', 'tab-selected']

Component({
  properties: {
    name: { type: String, value: 'service' },
    variant: { type: String, value: '' },
    color: { type: String, value: 'blue' },
    size: { type: Number, value: 24 },
    label: { type: String, value: '' },
    ariaLabel: { type: String, value: '' },
  },

  data: {
    src: '',
    sizeUnit: 'px',
    accessibleLabel: '',
    isV3: false,
    failed: false,
  },

  observers: {
    'name,variant,color,label,ariaLabel': function(
      name: string,
      variant: string,
      color: string,
      label: string,
      ariaLabel: string,
    ) {
      const isV3 = V3_VARIANTS.includes(variant)
      const safeColor = color === 'gray' ? 'gray' : 'blue'
      this.setData({
        src: isV3
          ? `/assets/icons/${variant}/${name}.png`
          : `/assets/icons/${safeColor}/${name}.png`,
        sizeUnit: isV3 ? 'rpx' : 'px',
        accessibleLabel: ariaLabel || label,
        isV3,
        failed: false,
      })
    },
  },

  methods: {
    error() {
      if (this.data.failed) return
      if (this.data.isV3) {
        this.setData({ failed: true })
        return
      }
      this.setData({ src: '/assets/icons/gray/service.png', failed: true })
    },
  },
})
