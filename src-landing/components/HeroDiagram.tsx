import { motion, useReducedMotion } from 'motion/react';

export function HeroDiagram() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="relative flex-1">
      <svg
        width="100%"
        height="400"
        viewBox="0 0 580 370"
        className="block"
        aria-label="Architecture diagram showing an e-commerce system"
      >
        {/* --- Edges (behind nodes) --- */}
        {/* Edge 1: dashed — opacity fade */}
        {reducedMotion ? (
          <path d="M200,70 L115,120" stroke="#907aa9" strokeWidth="1.6" fill="none" opacity="0.3" strokeDasharray="6 3" />
        ) : (
          <motion.path
            d="M200,70 L115,120"
            stroke="#907aa9"
            strokeWidth="1.6"
            fill="none"
            strokeDasharray="6 3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ delay: 1.2, duration: 0.6 }}
          />
        )}
        {/* Edge 2: solid — pathLength draw */}
        {reducedMotion ? (
          <path d="M280,70 L280,120" stroke="#56949f" strokeWidth="1.6" fill="none" opacity="0.35" />
        ) : (
          <motion.path
            d="M280,70 L280,120"
            stroke="#56949f"
            strokeWidth="1.6"
            fill="none"
            strokeDasharray="1"
            initial={{ pathLength: 0, opacity: 0.35 }}
            animate={{ pathLength: 1, opacity: 0.35 }}
            transition={{ delay: 1.2, duration: 0.6 }}
          />
        )}
        {/* Edge 3: solid — pathLength draw */}
        {reducedMotion ? (
          <path d="M360,70 L440,120" stroke="#907aa9" strokeWidth="1.6" fill="none" opacity="0.35" />
        ) : (
          <motion.path
            d="M360,70 L440,120"
            stroke="#907aa9"
            strokeWidth="1.6"
            fill="none"
            strokeDasharray="1"
            initial={{ pathLength: 0, opacity: 0.35 }}
            animate={{ pathLength: 1, opacity: 0.35 }}
            transition={{ delay: 1.2, duration: 0.6 }}
          />
        )}
        {/* Edge 4: solid — pathLength draw */}
        {reducedMotion ? (
          <path d="M95,180 L95,235" stroke="#286983" strokeWidth="1.6" fill="none" opacity="0.35" />
        ) : (
          <motion.path
            d="M95,180 L95,235"
            stroke="#286983"
            strokeWidth="1.6"
            fill="none"
            strokeDasharray="1"
            initial={{ pathLength: 0, opacity: 0.35 }}
            animate={{ pathLength: 1, opacity: 0.35 }}
            transition={{ delay: 1.2, duration: 0.6 }}
          />
        )}
        {/* Edge 5: solid — pathLength draw */}
        {reducedMotion ? (
          <path d="M260,180 L280,235" stroke="#ea9d34" strokeWidth="1.6" fill="none" opacity="0.35" />
        ) : (
          <motion.path
            d="M260,180 L280,235"
            stroke="#ea9d34"
            strokeWidth="1.6"
            fill="none"
            strokeDasharray="1"
            initial={{ pathLength: 0, opacity: 0.35 }}
            animate={{ pathLength: 1, opacity: 0.35 }}
            transition={{ delay: 1.2, duration: 0.6 }}
          />
        )}
        {/* Edge 6: solid — pathLength draw */}
        {reducedMotion ? (
          <path d="M420,180 L310,235" stroke="#ea9d34" strokeWidth="1.6" fill="none" opacity="0.35" />
        ) : (
          <motion.path
            d="M420,180 L310,235"
            stroke="#ea9d34"
            strokeWidth="1.6"
            fill="none"
            strokeDasharray="1"
            initial={{ pathLength: 0, opacity: 0.35 }}
            animate={{ pathLength: 1, opacity: 0.35 }}
            transition={{ delay: 1.2, duration: 0.6 }}
          />
        )}
        {/* Edge 7: dashed — opacity fade */}
        {reducedMotion ? (
          <path d="M320,180 L460,235" stroke="#d7827e" strokeWidth="1.6" fill="none" opacity="0.3" strokeDasharray="5 3" />
        ) : (
          <motion.path
            d="M320,180 L460,235"
            stroke="#d7827e"
            strokeWidth="1.6"
            fill="none"
            strokeDasharray="5 3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ delay: 1.2, duration: 0.6 }}
          />
        )}

        {/* --- Tier 1: Gateway (index 0) --- */}
        {reducedMotion ? (
          <g style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}>
            <rect x="195" y="15" width="170" height="54" rx="12" fill="#fff" stroke="#907aa9" strokeWidth="2" />
            <rect x="195" y="15" width="170" height="54" rx="12" fill="#907aa9" opacity="0.03" />
            <circle cx="220" cy="42" r="12" fill="#907aa9" opacity="0.08" />
            <text x="220" y="47" textAnchor="middle" fill="#907aa9" fontSize="13">&#x2B21;</text>
            <text x="295" y="38" textAnchor="middle" fill="#575279" fontSize="14" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">API Gateway</text>
            <text x="295" y="54" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">network/gateway</text>
          </g>
        ) : (
          <motion.g
            style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 * 0.15, duration: 0.5 }}
          >
            <rect x="195" y="15" width="170" height="54" rx="12" fill="#fff" stroke="#907aa9" strokeWidth="2" />
            <rect x="195" y="15" width="170" height="54" rx="12" fill="#907aa9" opacity="0.03" />
            <circle cx="220" cy="42" r="12" fill="#907aa9" opacity="0.08" />
            <text x="220" y="47" textAnchor="middle" fill="#907aa9" fontSize="13">&#x2B21;</text>
            <text x="295" y="38" textAnchor="middle" fill="#575279" fontSize="14" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">API Gateway</text>
            <text x="295" y="54" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">network/gateway</text>
          </motion.g>
        )}

        {/* --- Tier 2: Notification Svc (index 1) --- */}
        {reducedMotion ? (
          <g style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}>
            <rect x="15" y="122" width="160" height="54" rx="12" fill="#fff" stroke="#286983" strokeWidth="2" />
            <rect x="15" y="122" width="160" height="54" rx="12" fill="#286983" opacity="0.03" />
            <circle cx="40" cy="149" r="12" fill="#286983" opacity="0.08" />
            <text x="40" y="154" textAnchor="middle" fill="#286983" fontSize="12">&#x25A2;</text>
            <text x="108" y="145" textAnchor="middle" fill="#575279" fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">Notification Svc</text>
            <text x="108" y="161" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">compute/service</text>
          </g>
        ) : (
          <motion.g
            style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 * 0.15, duration: 0.5 }}
          >
            <rect x="15" y="122" width="160" height="54" rx="12" fill="#fff" stroke="#286983" strokeWidth="2" />
            <rect x="15" y="122" width="160" height="54" rx="12" fill="#286983" opacity="0.03" />
            <circle cx="40" cy="149" r="12" fill="#286983" opacity="0.08" />
            <text x="40" y="154" textAnchor="middle" fill="#286983" fontSize="12">&#x25A2;</text>
            <text x="108" y="145" textAnchor="middle" fill="#575279" fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">Notification Svc</text>
            <text x="108" y="161" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">compute/service</text>
          </motion.g>
        )}

        {/* Order Service (index 2) */}
        {reducedMotion ? (
          <g style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}>
            <rect x="200" y="122" width="160" height="54" rx="12" fill="#fff" stroke="#56949f" strokeWidth="2" />
            <rect x="200" y="122" width="160" height="54" rx="12" fill="#56949f" opacity="0.03" />
            <circle cx="225" cy="149" r="12" fill="#56949f" opacity="0.08" />
            <text x="225" y="154" textAnchor="middle" fill="#56949f" fontSize="12">&#x25A2;</text>
            <text x="293" y="145" textAnchor="middle" fill="#575279" fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">Order Service</text>
            <text x="293" y="161" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">compute/service</text>
          </g>
        ) : (
          <motion.g
            style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2 * 0.15, duration: 0.5 }}
          >
            <rect x="200" y="122" width="160" height="54" rx="12" fill="#fff" stroke="#56949f" strokeWidth="2" />
            <rect x="200" y="122" width="160" height="54" rx="12" fill="#56949f" opacity="0.03" />
            <circle cx="225" cy="149" r="12" fill="#56949f" opacity="0.08" />
            <text x="225" y="154" textAnchor="middle" fill="#56949f" fontSize="12">&#x25A2;</text>
            <text x="293" y="145" textAnchor="middle" fill="#575279" fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">Order Service</text>
            <text x="293" y="161" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">compute/service</text>
          </motion.g>
        )}

        {/* User Service (index 3) */}
        {reducedMotion ? (
          <g style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}>
            <rect x="385" y="122" width="160" height="54" rx="12" fill="#fff" stroke="#56949f" strokeWidth="2" />
            <rect x="385" y="122" width="160" height="54" rx="12" fill="#56949f" opacity="0.03" />
            <circle cx="410" cy="149" r="12" fill="#56949f" opacity="0.08" />
            <text x="410" y="154" textAnchor="middle" fill="#56949f" fontSize="12">&#x25A2;</text>
            <text x="478" y="145" textAnchor="middle" fill="#575279" fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">User Service</text>
            <text x="478" y="161" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">compute/service</text>
          </g>
        ) : (
          <motion.g
            style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 3 * 0.15, duration: 0.5 }}
          >
            <rect x="385" y="122" width="160" height="54" rx="12" fill="#fff" stroke="#56949f" strokeWidth="2" />
            <rect x="385" y="122" width="160" height="54" rx="12" fill="#56949f" opacity="0.03" />
            <circle cx="410" cy="149" r="12" fill="#56949f" opacity="0.08" />
            <text x="410" y="154" textAnchor="middle" fill="#56949f" fontSize="12">&#x25A2;</text>
            <text x="478" y="145" textAnchor="middle" fill="#575279" fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">User Service</text>
            <text x="478" y="161" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">compute/service</text>
          </motion.g>
        )}

        {/* --- Tier 3: Kafka (index 4) --- */}
        {reducedMotion ? (
          <g style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}>
            <rect x="25" y="237" width="140" height="54" rx="12" fill="#fff" stroke="#286983" strokeWidth="2" />
            <rect x="25" y="237" width="140" height="54" rx="12" fill="#286983" opacity="0.03" />
            <circle cx="52" cy="264" r="12" fill="#286983" opacity="0.08" />
            <text x="52" y="269" textAnchor="middle" fill="#286983" fontSize="13">&#x224B;</text>
            <text x="110" y="260" textAnchor="middle" fill="#575279" fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">Kafka</text>
            <text x="110" y="276" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">messaging/queue</text>
          </g>
        ) : (
          <motion.g
            style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 4 * 0.15, duration: 0.5 }}
          >
            <rect x="25" y="237" width="140" height="54" rx="12" fill="#fff" stroke="#286983" strokeWidth="2" />
            <rect x="25" y="237" width="140" height="54" rx="12" fill="#286983" opacity="0.03" />
            <circle cx="52" cy="264" r="12" fill="#286983" opacity="0.08" />
            <text x="52" y="269" textAnchor="middle" fill="#286983" fontSize="13">&#x224B;</text>
            <text x="110" y="260" textAnchor="middle" fill="#575279" fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">Kafka</text>
            <text x="110" y="276" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">messaging/queue</text>
          </motion.g>
        )}

        {/* PostgreSQL (index 5) */}
        {reducedMotion ? (
          <g style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}>
            <rect x="205" y="237" width="150" height="54" rx="27" fill="#fff" stroke="#ea9d34" strokeWidth="2" />
            <rect x="205" y="237" width="150" height="54" rx="27" fill="#ea9d34" opacity="0.03" />
            <circle cx="234" cy="264" r="12" fill="#ea9d34" opacity="0.08" />
            <text x="234" y="269" textAnchor="middle" fill="#ea9d34" fontSize="13">&#x26C1;</text>
            <text x="298" y="260" textAnchor="middle" fill="#575279" fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">PostgreSQL</text>
            <text x="298" y="276" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">data/sql</text>
          </g>
        ) : (
          <motion.g
            style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 5 * 0.15, duration: 0.5 }}
          >
            <rect x="205" y="237" width="150" height="54" rx="27" fill="#fff" stroke="#ea9d34" strokeWidth="2" />
            <rect x="205" y="237" width="150" height="54" rx="27" fill="#ea9d34" opacity="0.03" />
            <circle cx="234" cy="264" r="12" fill="#ea9d34" opacity="0.08" />
            <text x="234" y="269" textAnchor="middle" fill="#ea9d34" fontSize="13">&#x26C1;</text>
            <text x="298" y="260" textAnchor="middle" fill="#575279" fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">PostgreSQL</text>
            <text x="298" y="276" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">data/sql</text>
          </motion.g>
        )}

        {/* Redis (index 6) */}
        {reducedMotion ? (
          <g style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}>
            <rect x="395" y="237" width="130" height="54" rx="27" fill="#fff" stroke="#d7827e" strokeWidth="2" />
            <rect x="395" y="237" width="130" height="54" rx="27" fill="#d7827e" opacity="0.03" />
            <circle cx="422" cy="264" r="12" fill="#d7827e" opacity="0.08" />
            <text x="422" y="269" textAnchor="middle" fill="#d7827e" fontSize="13">&#x26C1;</text>
            <text x="474" y="260" textAnchor="middle" fill="#575279" fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">Redis</text>
            <text x="474" y="276" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">data/cache</text>
          </g>
        ) : (
          <motion.g
            style={{ filter: 'drop-shadow(0 4px 16px rgba(87,82,121,0.1))' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 6 * 0.15, duration: 0.5 }}
          >
            <rect x="395" y="237" width="130" height="54" rx="27" fill="#fff" stroke="#d7827e" strokeWidth="2" />
            <rect x="395" y="237" width="130" height="54" rx="27" fill="#d7827e" opacity="0.03" />
            <circle cx="422" cy="264" r="12" fill="#d7827e" opacity="0.08" />
            <text x="422" y="269" textAnchor="middle" fill="#d7827e" fontSize="13">&#x26C1;</text>
            <text x="474" y="260" textAnchor="middle" fill="#575279" fontSize="13" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">Redis</text>
            <text x="474" y="276" textAnchor="middle" fill="#797593" fontSize="10" fontFamily="Inter,system-ui,sans-serif">data/cache</text>
          </motion.g>
        )}

        {/* --- Edge labels --- */}
        <g>
          <rect x="133" y="88" width="48" height="16" rx="4" fill="rgba(250,244,237,0.92)" stroke="#dfdad9" strokeWidth="0.5" />
          <text x="157" y="99" textAnchor="middle" fill="#797593" fontSize="9" fontWeight="500" fontFamily="Inter,system-ui,sans-serif">async</text>
        </g>
        <g>
          <rect x="258" y="88" width="42" height="16" rx="4" fill="rgba(250,244,237,0.92)" stroke="#dfdad9" strokeWidth="0.5" />
          <text x="279" y="99" textAnchor="middle" fill="#797593" fontSize="9" fontWeight="500" fontFamily="Inter,system-ui,sans-serif">gRPC</text>
        </g>
        <g>
          <rect x="378" y="88" width="42" height="16" rx="4" fill="rgba(250,244,237,0.92)" stroke="#dfdad9" strokeWidth="0.5" />
          <text x="399" y="99" textAnchor="middle" fill="#797593" fontSize="9" fontWeight="500" fontFamily="Inter,system-ui,sans-serif">REST</text>
        </g>
        <g>
          <rect x="260" y="205" width="36" height="16" rx="4" fill="rgba(250,244,237,0.92)" stroke="#dfdad9" strokeWidth="0.5" />
          <text x="278" y="216" textAnchor="middle" fill="#797593" fontSize="9" fontWeight="500" fontFamily="Inter,system-ui,sans-serif">SQL</text>
        </g>

        {/* --- Breadcrumb --- */}
        <g>
          <rect x="10" y="305" width="130" height="22" rx="6" fill="rgba(250,244,237,0.88)" stroke="#dfdad9" strokeWidth="0.5" />
          <text x="18" y="319" fill="#797593" fontSize="9" fontFamily="Inter,system-ui,sans-serif">root</text>
          <text x="39" y="319" fill="#dfdad9" fontSize="9">&#x203A;</text>
          <text x="47" y="319" fill="#575279" fontSize="9" fontWeight="600" fontFamily="Inter,system-ui,sans-serif">main</text>
          <text x="71" y="319" fill="#dfdad9" fontSize="9">&#x203A;</text>
          <text x="79" y="319" fill="#907aa9" fontSize="9" fontWeight="600" fontFamily="Inter,system-ui,sans-serif">e-commerce</text>
        </g>
      </svg>

      {/* --- AI chat bubble (HTML overlay) --- */}
      {reducedMotion ? (
        <div className="absolute -bottom-2 right-3 bg-white border border-border rounded-[10px] px-3.5 py-2.5 shadow-[0_4px_20px_rgba(87,82,121,0.1)] max-w-[200px]">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-4 h-4 rounded bg-gold flex items-center justify-center">
              <span className="text-white text-[8px] font-bold">AI</span>
            </div>
            <span className="text-dark-purple text-[10px] font-semibold">Claude</span>
          </div>
          <div className="text-muted text-[10px] leading-snug">
            Added Order Service with gRPC connection to API Gateway
          </div>
        </div>
      ) : (
        <motion.div
          className="absolute -bottom-2 right-3 bg-white border border-border rounded-[10px] px-3.5 py-2.5 shadow-[0_4px_20px_rgba(87,82,121,0.1)] max-w-[200px]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.4 }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-4 h-4 rounded bg-gold flex items-center justify-center">
              <span className="text-white text-[8px] font-bold">AI</span>
            </div>
            <span className="text-dark-purple text-[10px] font-semibold">Claude</span>
          </div>
          <div className="text-muted text-[10px] leading-snug">
            Added Order Service with gRPC connection to API Gateway
          </div>
        </motion.div>
      )}
    </div>
  );
}
