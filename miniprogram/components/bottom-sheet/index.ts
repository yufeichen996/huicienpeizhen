Component({
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '' },
  },
  methods: {
    close() {
      this.triggerEvent('close')
    },
    noop() {},
  },
})
