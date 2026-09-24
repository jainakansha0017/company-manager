# Fifteen minutes of idleness ends the session. The cookie is rewritten on every
# request, so the fifteen minutes run from the last one rather than from signing
# in — working all afternoon never interrupts anyone.
#
# `expire_after` is sealed inside the encrypted cookie as well as set on it, so
# a browser that keeps the cookie past its time is still refused by the server.
#
# The register is read on a shared desk in a trading office, so a screen left
# open is a screen anyone can use.
Rails.application.config.session_store :cookie_store,
                                       key: "_company_manager_session",
                                       expire_after: 15.minutes,
                                       httponly: true,
                                       same_site: :lax,
                                       secure: Rails.env.production?
