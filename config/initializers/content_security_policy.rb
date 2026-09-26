# Everything the app actually serves — scripts, styles, the esbuild bundle —
# is same-origin (no CDNs, no inline <script>/<style> in the SPA shell, no
# `dangerouslySetInnerHTML`), so this can be strict rather than the commented
# Rails default. `:data` on img/font is the one allowance, for any future
# inline icon/font — nothing currently in the app needs it either.
Rails.application.configure do
  config.content_security_policy do |policy|
    policy.default_src :self
    policy.font_src    :self, :data
    policy.img_src     :self, :data
    policy.object_src  :none
    policy.script_src  :self
    policy.style_src   :self
    policy.connect_src :self
    policy.base_uri    :none
    policy.form_action :self
  end
end
