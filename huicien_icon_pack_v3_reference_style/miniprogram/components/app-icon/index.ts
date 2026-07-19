Component({
  properties: {
    name: { type: String, value: 'home' },
    variant: { type: String, value: 'outline' },
    size: { type: Number, value: 48 },
    ariaLabel: { type: String, value: '' }
  },
  data: { src: '' },
  observers: {
    'name,variant': function(name: string, variant: string) {
      const allowed = ['outline', 'tile', 'tab-unselected', 'tab-selected']
      const safeVariant = allowed.includes(variant) ? variant : 'outline'
      this.setData({ src: `/assets/icons/${safeVariant}/${name}.png` })
    }
  }
})
