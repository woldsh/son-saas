'use client';

import RejectedRequestsFeedback from '@/components/RejectedRequestsFeedback';
import { motion } from 'framer-motion';

export default function PortalFeedbackPage() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.4 }}
            className="p-4 sm:p-6 lg:p-8"
        >
            <RejectedRequestsFeedback />
        </motion.div>
    );
}
